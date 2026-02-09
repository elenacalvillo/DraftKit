

# Shared Workspace: "Claim to Edit" Collaborative Writing

## Overview

Add an in-app async writing workspace to approved collaboration requests. Instead of linking out to Google Docs, creators and guests can write directly inside DraftKit using a turn-based "Claim to Edit" model -- one person edits at a time, saves, and the other sees the latest version.

## Database Changes

Add two new columns to `collab_requests`:

```sql
ALTER TABLE collab_requests
  ADD COLUMN shared_content text,
  ADD COLUMN content_last_edited_by text,
  ADD COLUMN content_last_edited_at timestamptz;
```

- `shared_content` -- the master draft text, editable by both parties
- `content_last_edited_by` -- display name of the last editor (e.g., "Dinah" or "Karo")
- `content_last_edited_at` -- timestamp of the last save

No new RLS policies needed -- existing creator and requester UPDATE/SELECT policies on `collab_requests` already cover both parties.

**Important RLS note:** The requester UPDATE policy currently only allows updating `status` and `hidden_by_requester`. A new policy is needed to let the requester update the workspace fields:

```sql
CREATE POLICY "Requesters can edit shared workspace"
  ON collab_requests FOR UPDATE
  USING (requester_user_id = auth.uid() AND status = 'approved')
  WITH CHECK (
    shared_content IS NOT DISTINCT FROM shared_content
    AND content_last_edited_by IS NOT DISTINCT FROM content_last_edited_by
    AND content_last_edited_at IS NOT DISTINCT FROM content_last_edited_at
  );
```

This will be refined during implementation to ensure only the three workspace columns can be modified by the requester on approved requests.

## New Component: SharedWorkspace

Create `src/components/requests/SharedWorkspace.tsx`

### Props
```typescript
interface SharedWorkspaceProps {
  requestId: string;
  sharedContent: string | null;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  currentUserName: string;
  canEdit: boolean; // true for both creator and guest on approved requests
  onContentSaved: (content: string, editedBy: string) => void;
}
```

### Two Modes

**View Mode (default):**
- Renders `shared_content` as clean formatted text (preserving line breaks, whitespace)
- Shows "Last updated by [Name] at [Time]" footer
- Prominent "Edit Draft" button
- If no content exists yet, shows an empty state with "Start Writing" button

**Edit Mode (after clicking "Edit Draft"):**
- A clean, auto-resizing `<textarea>` styled to feel like a writing tool (generous padding, readable font size, no distracting borders)
- Prominent banner at top: "You are currently editing. Remember to Save so [other person] can see your changes."
- "Save and Sync" primary button + "Cancel" secondary button
- Save writes to Supabase and switches back to View Mode
- Cancel discards unsaved changes and returns to View Mode

### Visual Design
- The workspace sits inside the RequestCard for approved requests, replacing the current "Collaboration Link" section as the primary workspace
- The existing collab link input remains as an optional "External Link" below the workspace (for cases where they still want to link a Google Doc alongside)
- Minimum textarea height of 300px for a real writing feel
- Monospace or serif font option for the editing area to feel like a document editor

## Changes to Existing Files

### 1. src/components/requests/RequestCard.tsx

- Import and render `SharedWorkspace` inside the approved section, between the action buttons and the collab link
- Pass `shared_content`, `content_last_edited_by`, `content_last_edited_at` from the request
- Add `handleContentSaved` handler that updates Supabase and local state
- Access the new fields via the request object (update `(request as any)` pattern or extend the interface)

### 2. src/pages/Requests.tsx

- Add `shared_content`, `content_last_edited_by`, `content_last_edited_at` to `DbCollabRequest` interface
- Pass these through in the `mappedRequests` mapping (or as raw DB fields)
- Add a `handleCollabTypeChanged` handler (currently missing from props passed to RequestCard)

### 3. src/pages/MyRequests.tsx (Guest View)

- Fetch `shared_content`, `content_last_edited_by`, `content_last_edited_at` in the query
- Render the same `SharedWorkspace` component for approved requests
- Guest can also click "Edit Draft", write, and save
- The `currentUserName` will be the guest's `requester_name`

### 4. src/lib/storage.ts

- Extend `CollabRequest` interface with optional `sharedContent`, `contentLastEditedBy`, `contentLastEditedAt` fields

## User Flow

### Creator (Dinah) Flow
1. Approves a collaboration request
2. Sees an empty Shared Workspace with "Start Writing" button
3. Clicks "Start Writing" -- textarea appears with editing banner
4. Pastes or writes her content
5. Clicks "Save and Sync" -- content is saved to database, view switches back
6. Footer shows: "Last updated by Dinah at 2:30 PM"

### Guest (Karo) Flow
1. Goes to "Sent Requests" page, sees the approved request
2. Sees Dinah's content rendered in the workspace
3. Footer shows: "Last updated by Dinah at 2:30 PM"
4. Clicks "Edit Draft" -- content loads into textarea
5. Edits/adds their section
6. Clicks "Save and Sync" -- saved, Dinah will see updates next time she opens

## What This Does NOT Include (By Design)
- No real-time sync / WebSockets (avoids credit drain)
- No version history (keeps it simple for v1)
- No Markdown rendering (plain text with whitespace preservation -- avoids complexity)
- No locking mechanism (the "banner + last edited by" is the anti-collision pattern)

## Technical Summary

| Item | Detail |
|------|--------|
| New DB columns | `shared_content`, `content_last_edited_by`, `content_last_edited_at` on `collab_requests` |
| New RLS policy | Allow requester to update workspace columns on approved requests |
| New component | `SharedWorkspace.tsx` |
| Modified files | `RequestCard.tsx`, `Requests.tsx`, `MyRequests.tsx`, `storage.ts` |
| Cost model | Standard SELECT/UPDATE queries only -- no Realtime subscriptions |

