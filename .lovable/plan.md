

## Where metrics are visible today — and where they should be

### Current state
The `CollabImpactCard` is rendered only inside `RequestCard.tsx`, which lives on the host's **Requests page** (`/dashboard/requests`) for published collaborations. The guest's view (`MyRequests.tsx` / Sent Requests) does not show it.

### Recommended additions

**1. Guest's Sent Requests page (`MyRequests.tsx`)**
Add `CollabImpactCard` to the published state in the guest's request view so both parties can see engagement data.

**2. Workspace page (`Workspace.tsx`)**
When viewing a published workspace, show the impact card at the top or bottom of the shared content area — this is the most natural place to review collab outcomes.

**3. Dashboard summary (optional, lightweight)**
On the main Dashboard, surface a small "Recent Collab Impact" widget or badge showing aggregate engagement for the latest published collab.

### Implementation scope
- **MyRequests.tsx**: Import `CollabImpactCard`, render it for requests with `status === 'published'` (same pattern as RequestCard)
- **Workspace.tsx**: Import and render `CollabImpactCard` when the workspace's request status is `published`
- **RLS**: The existing policy already allows requesters to read their own metrics (`requester_id` match), so no DB changes needed
- Minor: pass correct `creatorName` / `requesterName` props from each context

This is a small UI wiring task — no new tables, edge functions, or migrations required.

