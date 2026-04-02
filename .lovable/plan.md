

# Add "Cancel Collab" to Workspace Sidebar

## Problem

Once a collaboration is approved, neither the host (creator) nor the guest can cancel it from the workspace. The only existing cancel logic works on `pending` requests via a different RLS policy.

## Changes

### 1. Database: New RLS policy for cancelling approved collabs

The current RLS only allows creators to update approved requests (for workspace edits, publishing, etc.) and requesters to edit `shared_content` on approved requests. Neither policy restricts the status transition, but the creator's update policy is broad enough to allow setting `status = 'cancelled'`. However, the **guest** cannot cancel an approved collab — their update policy only covers `status = 'pending'`.

**Migration**: Add a new RLS policy so requesters can also cancel approved collabs:

```sql
CREATE POLICY "Requesters can cancel approved requests"
ON public.collab_requests
FOR UPDATE
TO public
USING (requester_user_id = auth.uid() AND status = 'approved')
WITH CHECK (status = 'cancelled');
```

### 2. `src/pages/Workspace.tsx`

In the sidebar "Action Buttons" section (around line 804), add a "Cancel Collab" button **for both creator and guest** when `request.status === 'approved'`:

- Wrapped in an `AlertDialog` for confirmation (same pattern as MyRequests.tsx)
- Confirmation text: "This will cancel the collaboration with [partner name]. The workspace content will be preserved but editing will be locked."
- On confirm: update `collab_requests` set `status = 'cancelled'` where `id = request.id`
- Send notification email via `send-collab-email` with type `collab_cancelled`
- After success: navigate back to `/dashboard/requests` (creator) or `/dashboard/my-requests` (guest)
- Button styled as `variant="ghost"` with destructive hover colors, placed below the Message button
- Import `Trash2` icon (or `XCircle`) and `AlertDialog` components

### 3. `src/pages/MyRequests.tsx`

The cancel button currently only shows for `pending` requests. Add the same cancel option for `approved` requests:
- Reuse the existing `AlertDialog` pattern but adjust the confirmation text for approved collabs
- The handler updates status to `cancelled` (same DB call)

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | New RLS policy for requesters cancelling approved collabs |
| `src/pages/Workspace.tsx` | Add "Cancel Collab" button with AlertDialog in sidebar |
| `src/pages/MyRequests.tsx` | Extend cancel option to approved requests |

