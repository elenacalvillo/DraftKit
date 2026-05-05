# Fix public draft view: hide private title, load creator avatar

## What's wrong

Looking at the live data and the `get_public_sheet` RPC:

```sql
RETURNS TABLE(request_id, project_title, shared_content, creator_name, creator_username)
-- project_title := COALESCE(selected_collab_type, 'Untitled draft')
```

1. **"Untitled draft" title block** — `project_title` comes from `selected_collab_type` (an internal field like "Cross-promotion" / often empty). It's owner-side metadata, not a public draft headline. The actual article H1 already lives in `shared_content`. Showing "THE DRAFT / Untitled draft" above the content adds noise and leaks an internal label.
2. **Missing avatar (showing "EC" fallback)** — The RPC never returns `creator_profile_image_url` or `invite_message`, even though `PublicWorkspaceView.tsx` reads `sheet.creator_profile_image_url`. So the avatar always falls back to initials and the invite-note always shows the default copy.

## Plan

### 1. Migration: extend `get_public_sheet`

Drop & recreate the function to also return `creator_profile_image_url` and `invite_message`:

```sql
CREATE OR REPLACE FUNCTION public.get_public_sheet(_token uuid)
RETURNS TABLE(
  request_id uuid,
  shared_content text,
  creator_name text,
  creator_username text,
  creator_profile_image_url text,
  invite_message text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    cr.id,
    cr.shared_content,
    c.name,
    c.username,
    c.profile_image_url,
    NULL::text  -- invite_message column doesn't exist yet; keep placeholder for forward-compat
  FROM public.collab_requests cr
  JOIN public.creators c ON c.id = cr.creator_id
  WHERE cr.view_token = _token
  LIMIT 1;
$$;
```

Note: `invite_message` column doesn't exist on `collab_requests` today — the frontend already falls back to default copy. Keep the field in the RPC signature so the existing client code keeps working; we can wire a real column later without another RPC change.

`project_title` is dropped from the return shape — it was internal-only.

### 2. `src/pages/PublicWorkspaceView.tsx`

- Remove the `<header>` block that renders "THE DRAFT / {project_title}" above the content. The article body's own headings are the public title.
- Remove `project_title` from the `PublicSheet` interface and from `document.title` (use `${creator_name}'s draft · DraftKit` instead, so the browser tab doesn't leak the internal label either).
- No other changes — `creator_profile_image_url` is already read & passed through `sanitizeSubstackImageUrl`; once the RPC returns it, the avatar will render.

## Files touched
- New migration (recreate `get_public_sheet`)
- `src/pages/PublicWorkspaceView.tsx`

Approve and I'll ship it.