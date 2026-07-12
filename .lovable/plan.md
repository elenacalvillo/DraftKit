## Problem

`list_my_workspaces()` includes every chapter where the user is the project owner, so solo, unshared book chapters flood Collaborations (200+ rows for Elena's Verloren manuscript). Collaborations should only surface *shared* spaces.

## Fix

Filter the `project_owner` branch of `list_my_workspaces()` so a project chapter only appears when at least one *other* participant exists on it.

### SQL change (single migration)

In the `base` CTE's `project_owner` UNION arm, keep the row only if it has an external participant:

```sql
-- Project owner: only when the chapter is actually shared
SELECT cr.id, 'project_owner'::text, NULL::timestamp with time zone
FROM public.collab_requests cr
JOIN public.projects p ON p.id = cr.project_id
JOIN public.creators c ON c.id = p.creator_id
WHERE cr.is_project_workspace = true
  AND c.user_id = (SELECT uid FROM me)
  AND cr.hidden_by_creator = false
  AND (
    -- Someone else was invited as a collaborator
    EXISTS (
      SELECT 1 FROM public.workspace_collaborators wc
      WHERE wc.request_id = cr.id
        AND (wc.user_id IS NULL OR wc.user_id <> (SELECT uid FROM me))
    )
    -- Or a different user is the requester (self-assigned to someone else)
    OR (cr.requester_user_id IS NOT NULL AND cr.requester_user_id <> (SELECT uid FROM me))
  )
```

The `host` and `requester` arms are unchanged: classic collabs, solo drafts the user explicitly created in the workspace flow, and invited chapters continue to appear. Only the "I own the project and I'm alone on this chapter" case is suppressed.

### What stays where

- **Solo book chapters (no invitees)** → visible in `/dashboard/projects/:id` only. Hidden from Collaborations and Dashboard recent feed.
- **Shared book chapters** → still surface in Collaborations with the `Project` badge.
- **Classic solo drafts** (`is_solo=true`, non-project) → unchanged; still show in Collaborations because that's their only home.

### Files touched

- New migration: tweak `public.list_my_workspaces()` (function body only, no schema change).
- No frontend or hook changes required — `useMyWorkspaces` and `Collaborations.tsx` keep working as-is.

### Verification

After migration: as Elena, `/dashboard/collaborations` Active tab should drop from ~200 to just the classic collabs + book chapters that actually have another writer on them. Karen's self-assigned chapters (where she's both project owner and requester) stay hidden until she invites someone — which matches the "Collaborations = shared spaces" definition.
