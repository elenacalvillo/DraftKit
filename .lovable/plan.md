## What's actually happening

**Elena's "Workspace not found"**: Not an RLS bug in this case. The DB shows Elena (`elenacalvilloalcalde@gmail.com`) IS listed as a `guest` in `workspace_collaborators` for workspace `647ecb80…`. `has_workspace_access` will pass for her. Most likely she loaded the page before her collaborator row was linked to her user_id, or before a hard refresh. No data patch or RLS change needed — a reload will resolve it. If it persists, we investigate her session/user_id linkage, not the policy.

**Karen's dead-end**: Real product gap. Karen is a workspace guest (not a Project-tier subscriber), so the sidebar never renders a Projects entry, and `Proposals` (`MyRequests.tsx`) only queries `collab_requests` where `requester_user_id = auth.uid()`. Workspaces she was invited to via `workspace_collaborators` are invisible in her dashboard. Her only re-entry is the email link.

## Fix: add "Shared with me" to the Proposals page

Extend `src/pages/MyRequests.tsx` to also fetch and render workspaces the user was invited into as a collaborator. Keep it on the existing Proposals route so guests don't need a new sidebar item.

### UX

- New section header **"Shared with me"** below the existing Proposals list (or above it when the user has no proposals of their own).
- Each row: host name + avatar, workspace title/chapter name, role badge ("Guest" or "Collaborator"), last-edited timestamp, and a primary **Open workspace** button routing to `/dashboard/workspace/{request_id}`.
- Empty state only shown when the user has neither proposals nor shared workspaces (current empty state stays as-is otherwise).
- Guest-only accounts (no proposals, no Project tier) still land on `/dashboard/my-requests` after login; this section makes that page useful for them.

### Data

Query added to `MyRequests.tsx` after the existing `fetchSentRequests`:

```
supabase
  .from('workspace_collaborators')
  .select(`
    request_id, role, joined_at,
    collab_requests:request_id (
      id, status, is_project_workspace, project_id, shared_content,
      content_last_edited_at, content_last_edited_by,
      creator:creator_id ( name, username, profile_image_url )
    )
  `)
  .eq('user_id', user.id)
  .order('joined_at', { ascending: false });
```

Filter out rows where the parent request is `cancelled` or `declined`. De-duplicate against the user's own proposals (edge case: user is both requester and listed collaborator).

### Sidebar nudge (small)

No new sidebar item — Proposals already exists for all tiers and is where guests naturally look. We just make sure guest-only users see something meaningful there.

## What is NOT changing

- No RLS policy edits. `has_workspace_access` is correct; Elena's issue is a stale-session symptom, not a policy hole.
- No changes to the Projects sidebar entry (still Project-tier only, per the tier hierarchy).
- No new route, no new top-level page.
- No data patch to add Elena as an "approved collaborator" on workspaces she isn't part of — she's the platform admin; if she needs to inspect a workspace she's not on, that's an admin tooling concern, out of scope here.

## Files touched

- `src/pages/MyRequests.tsx` — add "Shared with me" section, query, render, dedupe.

## Follow-up for Elena to send Karen

"You can jump back into your chapter any time from **Proposals** in your sidebar — I just added a 'Shared with me' list there so invited workspaces show up alongside your own."
