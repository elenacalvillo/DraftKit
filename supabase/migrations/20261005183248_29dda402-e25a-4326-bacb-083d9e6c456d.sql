-- Single project role resolver
CREATE OR REPLACE FUNCTION public.project_role(_user_id uuid, _project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _project_id IS NULL THEN NULL
    WHEN public.is_project_owner(_user_id, _project_id) THEN 'owner'
    ELSE (
      SELECT pm.role FROM public.project_members pm
      WHERE pm.project_id = _project_id AND pm.user_id = _user_id
      ORDER BY CASE pm.role WHEN 'admin' THEN 1 WHEN 'cross_chapter_reviewer' THEN 2
                            WHEN 'chapter_writer' THEN 3 ELSE 4 END
      LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.project_role(_user_id, _project_id) IN ('owner','admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.my_project_role(_project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_role(auth.uid(), _project_id);
$$;

REVOKE ALL ON FUNCTION public.project_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_project(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_project_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_project_role(uuid) TO authenticated;

-- Workspace access: host, guest, invited collaborator, or project-wide role on a chapter
CREATE OR REPLACE FUNCTION public.has_workspace_access(_user_id uuid, _request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM collab_requests cr JOIN creators c ON cr.creator_id = c.id
            WHERE cr.id = _request_id AND c.user_id = _user_id)
    OR EXISTS (SELECT 1 FROM collab_requests cr
               WHERE cr.id = _request_id AND cr.requester_user_id = _user_id)
    OR EXISTS (SELECT 1 FROM workspace_collaborators wc
               WHERE wc.request_id = _request_id AND wc.user_id = _user_id)
    OR EXISTS (SELECT 1 FROM collab_requests cr
               WHERE cr.id = _request_id
                 AND cr.is_project_workspace = true
                 AND cr.project_id IS NOT NULL
                 AND public.project_role(_user_id, cr.project_id) IN ('owner','admin','cross_chapter_reviewer'))
  );
$$;

-- Workspace loader now honours project roles
CREATE OR REPLACE FUNCTION public.get_workspace_request(_request_id uuid)
 RETURNS TABLE(id uuid, creator_id uuid, requester_user_id uuid, requester_name text, requester_email text, requester_substack_url text, requester_profile_image_url text, requester_collab_link text, message text, requested_date date, status text, created_at timestamp with time zone, ai_draft jsonb, collab_link text, shared_content text, content_last_edited_by text, content_last_edited_at timestamp with time zone, selected_collab_type text, is_solo boolean, editing_sessions jsonb, first_draft_generated_at timestamp with time zone, creator_notes text, approved_at timestamp with time zone, view_token uuid, retro_rating integer, retro_notes text, retro_completed_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_owner boolean := false;
  is_requester boolean := false;
BEGIN
  IF uid IS NULL OR NOT public.has_workspace_access(uid, _request_id) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM collab_requests cr JOIN creators c ON c.id = cr.creator_id
    WHERE cr.id = _request_id AND c.user_id = uid
  ) INTO is_owner;

  SELECT EXISTS (
    SELECT 1 FROM collab_requests cr WHERE cr.id = _request_id AND cr.requester_user_id = uid
  ) INTO is_requester;

  RETURN QUERY
  SELECT
    cr.id, cr.creator_id, cr.requester_user_id,
    CASE WHEN is_owner OR is_requester THEN cr.requester_name ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_email ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_substack_url ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_profile_image_url ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.requester_collab_link ELSE NULL END,
    cr.message, cr.requested_date, cr.status, cr.created_at, cr.ai_draft, cr.collab_link,
    cr.shared_content, cr.content_last_edited_by, cr.content_last_edited_at,
    cr.selected_collab_type, cr.is_solo, cr.editing_sessions, cr.first_draft_generated_at,
    CASE WHEN is_owner THEN cr.creator_notes ELSE NULL END,
    cr.approved_at,
    CASE WHEN is_owner OR is_requester THEN cr.view_token ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.retro_rating ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.retro_notes ELSE NULL END,
    CASE WHEN is_owner OR is_requester THEN cr.retro_completed_at ELSE NULL END
  FROM collab_requests cr
  WHERE cr.id = _request_id;
END;
$function$;

-- collab_requests: replace the over-broad member read rule
DROP POLICY IF EXISTS "Project members can view project workspaces" ON public.collab_requests;
CREATE POLICY "Project leads and reviewers view all chapters"
  ON public.collab_requests FOR SELECT TO authenticated
  USING (is_project_workspace = true AND project_id IS NOT NULL
         AND public.project_role(auth.uid(), project_id) IN ('owner','admin','cross_chapter_reviewer'));

CREATE POLICY "Project admins update chapters"
  ON public.collab_requests FOR UPDATE TO authenticated
  USING (is_project_workspace = true AND project_id IS NOT NULL AND public.can_manage_project(auth.uid(), project_id))
  WITH CHECK (is_project_workspace = true AND project_id IS NOT NULL AND public.can_manage_project(auth.uid(), project_id));

-- Field guard: add the project admin branch
CREATE OR REPLACE FUNCTION public.enforce_collaborator_field_restrictions()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_owner boolean;
  is_requester boolean;
  is_collaborator boolean;
  publish_cols text[] := ARRAY['status','collab_link','requester_collab_link','publish_prompt_suppressed_at'];
  admin_cols text[] := ARRAY['message','chapter_order','chapter_stage','shared_content','content_last_edited_by','content_last_edited_at','editing_sessions','ai_suggestion_used'];
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - publish_cols) = (to_jsonb(OLD) - publish_cols)
     AND NEW.status IN ('approved','published')
     AND OLD.status IN ('approved','published')
     AND public.has_workspace_access(uid, NEW.id)
  THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM creators c WHERE c.id = NEW.creator_id AND c.user_id = uid
  ) INTO is_owner;

  -- Project admins: chapter title, order, stage and text only.
  IF NOT is_owner
     AND COALESCE(OLD.is_project_workspace, false)
     AND OLD.project_id IS NOT NULL
     AND public.can_manage_project(uid, OLD.project_id)
  THEN
    IF (to_jsonb(NEW) - admin_cols) = (to_jsonb(OLD) - admin_cols) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Project admins can only change chapter title, order, stage and text';
  END IF;

  is_requester := (NEW.requester_user_id = uid) OR (OLD.requester_user_id = uid);

  SELECT EXISTS (
    SELECT 1 FROM workspace_collaborators wc
    WHERE wc.request_id = NEW.id AND wc.user_id = uid
  ) INTO is_collaborator;

  IF is_owner THEN
    IF NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
       OR NEW.requester_email IS DISTINCT FROM OLD.requester_email
       OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
       OR NEW.requester_substack_url IS DISTINCT FROM OLD.requester_substack_url
       OR NEW.requester_profile_image_url IS DISTINCT FROM OLD.requester_profile_image_url
       OR NEW.requester_collab_link IS DISTINCT FROM OLD.requester_collab_link
       OR NEW.retro_rating IS DISTINCT FROM OLD.retro_rating
       OR NEW.retro_notes IS DISTINCT FROM OLD.retro_notes
       OR NEW.retro_completed_at IS DISTINCT FROM OLD.retro_completed_at
       OR NEW.view_token IS DISTINCT FROM OLD.view_token
       OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Host cannot modify requester identity, retro submission, view token, or row ownership';
    END IF;
    RETURN NEW;
  END IF;

  IF is_requester THEN
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
       OR NEW.requester_email IS DISTINCT FROM OLD.requester_email
       OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
       OR NEW.requester_substack_url IS DISTINCT FROM OLD.requester_substack_url
       OR NEW.requester_profile_image_url IS DISTINCT FROM OLD.requester_profile_image_url
       OR NEW.creator_notes IS DISTINCT FROM OLD.creator_notes
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
       OR NEW.first_draft_generated_at IS DISTINCT FROM OLD.first_draft_generated_at
       OR NEW.hidden_by_creator IS DISTINCT FROM OLD.hidden_by_creator
       OR NEW.view_token IS DISTINCT FROM OLD.view_token
       OR NEW.is_solo IS DISTINCT FROM OLD.is_solo
       OR NEW.is_project_workspace IS DISTINCT FROM OLD.is_project_workspace
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.requested_date IS DISTINCT FROM OLD.requested_date
       OR NEW.selected_collab_type IS DISTINCT FROM OLD.selected_collab_type
       OR NEW.ai_draft IS DISTINCT FROM OLD.ai_draft
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Requester can only edit shared draft, editing sessions, their own retro, the published collab link, and their hide flag';
    END IF;
    RETURN NEW;
  END IF;

  IF is_collaborator THEN
    IF NEW.requester_email IS DISTINCT FROM OLD.requester_email
       OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
       OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
       OR NEW.requester_substack_url IS DISTINCT FROM OLD.requester_substack_url
       OR NEW.requester_profile_image_url IS DISTINCT FROM OLD.requester_profile_image_url
       OR NEW.requester_collab_link IS DISTINCT FROM OLD.requester_collab_link
       OR NEW.creator_notes IS DISTINCT FROM OLD.creator_notes
       OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.ai_draft IS DISTINCT FROM OLD.ai_draft
       OR NEW.collab_link IS DISTINCT FROM OLD.collab_link
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.view_token IS DISTINCT FROM OLD.view_token
       OR NEW.hidden_by_creator IS DISTINCT FROM OLD.hidden_by_creator
       OR NEW.hidden_by_requester IS DISTINCT FROM OLD.hidden_by_requester
       OR NEW.retro_rating IS DISTINCT FROM OLD.retro_rating
       OR NEW.retro_notes IS DISTINCT FROM OLD.retro_notes
       OR NEW.retro_completed_at IS DISTINCT FROM OLD.retro_completed_at
       OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
       OR NEW.requested_date IS DISTINCT FROM OLD.requested_date
       OR NEW.is_solo IS DISTINCT FROM OLD.is_solo
       OR NEW.selected_collab_type IS DISTINCT FROM OLD.selected_collab_type
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.first_draft_generated_at IS DISTINCT FROM OLD.first_draft_generated_at
    THEN
      RAISE EXCEPTION 'Collaborators can only edit shared workspace content fields';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this collab request';
END;
$function$;

-- Chapter creation for owners and admins
CREATE OR REPLACE FUNCTION public.create_project_chapter(_project_id uuid, _title text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  _creator_id uuid;
  _owner_uid uuid;
  _owner_email text;
  _owner_name text;
  _archived boolean;
  _next int;
  _id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.can_manage_project(uid, _project_id) THEN
    RAISE EXCEPTION 'Not authorized for this project' USING ERRCODE = '42501';
  END IF;
  IF _title IS NULL OR length(btrim(_title)) = 0 OR length(btrim(_title)) > 2000 THEN
    RAISE EXCEPTION 'Chapter title is required' USING ERRCODE = '23514';
  END IF;

  SELECT p.creator_id, p.is_archived, c.user_id, c.name
    INTO _creator_id, _archived, _owner_uid, _owner_name
  FROM projects p JOIN creators c ON c.id = p.creator_id WHERE p.id = _project_id;
  IF _creator_id IS NULL THEN RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002'; END IF;
  IF _archived THEN RAISE EXCEPTION 'Project is archived' USING ERRCODE = 'P0001'; END IF;

  SELECT u.email INTO _owner_email FROM auth.users u WHERE u.id = _owner_uid;

  SELECT COALESCE(MAX(chapter_order), 0) + 1 INTO _next
  FROM collab_requests WHERE project_id = _project_id AND is_project_workspace = true;

  -- Chapters are solo spaces owned by the project owner; contributors join via workspace_collaborators.
  INSERT INTO collab_requests (creator_id, project_id, is_project_workspace, chapter_order, is_solo,
                               message, requester_user_id, requester_email, requester_name, status, chapter_stage)
  VALUES (_creator_id, _project_id, true, _next, true, btrim(_title), _owner_uid,
          COALESCE(_owner_email, 'owner@draftkit.app'), COALESCE(_owner_name, 'Owner'), 'approved', 'draft')
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_project_chapter(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_chapter(uuid, text) TO authenticated;

-- Revisions: only people who can open the chapter
DROP POLICY IF EXISTS "Workspace or project participants can view revisions" ON public.chapter_revisions;
CREATE POLICY "Workspace participants can view revisions"
  ON public.chapter_revisions FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), request_id));

-- Messages: one rule for everyone who can open the workspace
DROP POLICY IF EXISTS "Collaborators can send workspace messages" ON public.collaboration_messages;
DROP POLICY IF EXISTS "Requesters can insert messages for their requests" ON public.collaboration_messages;
DROP POLICY IF EXISTS "Creators can insert messages for their requests" ON public.collaboration_messages;
DROP POLICY IF EXISTS "Creators can view messages for their requests" ON public.collaboration_messages;
DROP POLICY IF EXISTS "Collaborators can view workspace messages" ON public.collaboration_messages;
DROP POLICY IF EXISTS "Requesters can view messages for their requests" ON public.collaboration_messages;
CREATE POLICY "Workspace participants view messages"
  ON public.collaboration_messages FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), request_id));
CREATE POLICY "Workspace participants send messages"
  ON public.collaboration_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_access(auth.uid(), request_id));

-- Project members: owner or admin manage
DROP POLICY IF EXISTS "Owners manage project members" ON public.project_members;
CREATE POLICY "Project managers manage members"
  ON public.project_members FOR ALL TO authenticated
  USING (public.can_manage_project(auth.uid(), project_id))
  WITH CHECK (public.can_manage_project(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.guard_project_member_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_project_owner(uid, COALESCE(NEW.project_id, OLD.project_id)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'Members cannot be moved between projects';
    END IF;
    IF OLD.user_id = uid AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own project role';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS guard_project_member_changes ON public.project_members;
CREATE TRIGGER guard_project_member_changes
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_member_changes();

-- Projects: admins edit details; only the owner archives or transfers
CREATE POLICY "Project admins update project details"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.can_manage_project(auth.uid(), id))
  WITH CHECK (public.can_manage_project(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.guard_project_owner_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_project_owner(uid, OLD.id) THEN
    RETURN NEW;
  END IF;
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.is_archived IS DISTINCT FROM OLD.is_archived
     OR NEW.cover_image_path IS DISTINCT FROM OLD.cover_image_path
     OR NEW.cover_image_mime IS DISTINCT FROM OLD.cover_image_mime
     OR NEW.cover_image_bytes IS DISTINCT FROM OLD.cover_image_bytes
  THEN
    RAISE EXCEPTION 'Only the project owner can archive, transfer, or change the cover';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_project_owner_fields ON public.projects;
CREATE TRIGGER guard_project_owner_fields
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_owner_fields();

-- Broadcast log: owner or admin
DROP POLICY IF EXISTS "Owners can insert broadcasts" ON public.project_broadcasts;
CREATE POLICY "Project managers can insert broadcasts"
  ON public.project_broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project(auth.uid(), project_id));

REVOKE ALL ON FUNCTION public.guard_project_member_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_project_owner_fields() FROM PUBLIC, anon, authenticated;