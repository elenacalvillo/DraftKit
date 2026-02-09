

# Dedicated Workspace Page

## Overview

Move the SharedWorkspace out of the crowded RequestCard and into its own focused route at `/dashboard/workspace/:requestId`. The Requests page stays clean for management; the Workspace page becomes a distraction-free writing environment.

## New Route

```
/dashboard/workspace/:requestId
```

## Layout

A two-panel layout inside `DashboardLayout`:

```text
+-------------------------------------------+
| Left Panel (320px)     | Right Panel      |
|                        |                  |
| Collaboration Context  | Shared Workspace |
| - Requester name/pic   | (full height)    |
| - Substack link        |                  |
| - Requested date       | [Edit Draft]     |
| - Message quote        |                  |
| - Status badge         | textarea or      |
| - AI Draft button      | rendered content |
| - External doc link    |                  |
| - Message button       | Last edited by   |
|                        | [Name] at [Time] |
| [Back to Requests]     |                  |
+-------------------------------------------+
```

On mobile, the left panel stacks above the workspace.

---

## Files to Create

### 1. `src/pages/Workspace.tsx`

The dedicated workspace page. It will:

- Accept `:requestId` from the URL params
- Fetch the `collab_request` row from the database (with creator details)
- Determine if the current user is the **creator** or the **guest** (requester)
- Render a two-panel layout:
  - **Left panel**: Request context card (name, avatar, Substack link, date, message, status, AI draft button, collab link, message button)
  - **Right panel**: The existing `SharedWorkspace` component, rendered large and prominent
- Handle the `onContentSaved` callback to update local state
- Redirect to `/login` if not authenticated, or show 404 if the request doesn't belong to the user

### Key data fetch logic:

```typescript
// Determine role
const isCreator = creator?.id === request.creator_id;
const isGuest = user?.id === request.requester_user_id;

// Set current user name accordingly
const currentUserName = isCreator ? creator.name : request.requester_name;
```

---

## Files to Modify

### 2. `src/App.tsx`

Add the new route:

```typescript
import Workspace from "./pages/Workspace";

// Inside Routes:
<Route path="/dashboard/workspace/:requestId" element={<Workspace />} />
```

### 3. `src/components/requests/RequestCard.tsx`

For approved requests, replace the inline `SharedWorkspace` component with an "Enter Workspace" button:

```tsx
{/* Replace SharedWorkspace embed with navigation button */}
{request.status === "approved" && (
  <div className="space-y-4">
    {/* existing draft/message/cancel buttons */}
    
    <Button
      variant="gradient"
      className="w-full"
      onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
    >
      <PenLine className="w-4 h-4 mr-2" />
      Enter Workspace
    </Button>
    
    {/* collab link section stays */}
  </div>
)}
```

Remove the `SharedWorkspace` import and inline rendering from this file.

### 4. `src/pages/MyRequests.tsx`

Same change for the guest view: replace the inline `SharedWorkspace` with an "Enter Workspace" button that navigates to `/dashboard/workspace/:requestId`.

```tsx
{request.status === 'approved' && (
  <div className="space-y-3 pt-3 border-t mt-3">
    <Button
      variant="default"
      className="w-full"
      onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
    >
      <PenLine className="w-4 h-4 mr-2" />
      Enter Workspace
    </Button>
    
    {/* Keep collab link + message buttons */}
  </div>
)}
```

---

## Workspace Page Design Details

The page uses `DashboardLayout` for consistent navigation, with a clean two-column interior:

**Left panel (context sidebar):**
- Back arrow link to `/dashboard/requests` or `/dashboard/my-requests` depending on role
- Avatar + requester/creator name
- Substack link
- Requested date
- Original message (blockquote style)
- AI Draft actions (Generate/View Draft button + modal -- reuse existing logic)
- External doc link (if set)
- Message button

**Right panel (writing area):**
- The existing `SharedWorkspace` component, given full width and breathing room
- No changes needed to `SharedWorkspace.tsx` itself -- it already handles view/edit modes, save logic, and anti-collision banners

**Mobile layout:**
- Single column: context card collapsed/summary at top, workspace below

---

## What Stays the Same

- `SharedWorkspace.tsx` -- no changes needed, it's already a self-contained component
- `CollabDraftModal.tsx` -- reused as-is on the workspace page
- `SendMessageModal.tsx` -- reused as-is on the workspace page
- Database schema -- no changes needed
- RLS policies -- no changes needed

## Summary of Changes

| File | Action |
|------|--------|
| `src/pages/Workspace.tsx` | **Create** -- dedicated workspace page |
| `src/App.tsx` | **Edit** -- add route |
| `src/components/requests/RequestCard.tsx` | **Edit** -- replace inline workspace with "Enter Workspace" button |
| `src/pages/MyRequests.tsx` | **Edit** -- replace inline workspace with "Enter Workspace" button |

