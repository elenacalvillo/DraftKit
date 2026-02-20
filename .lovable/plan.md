
## Root Cause Analysis

### What the database actually contains

After querying the database directly:

- Raghav (Feb 12) → `status: approved`
- James (Feb 19) → `status: approved`
- Declined/Cancelled rows → `hidden_by_creator: true` (soft-deleted by clicking "delete")

**Published tab is empty because no row has ever been saved with `status = 'published'` in the database.** The "Congrats 🎉" toast fires every time, masking the failure.

---

### Root Cause: `isCreator` is false when `handlePublishAnswer` runs

In `Workspace.tsx` line 67:

```typescript
const isCreator = !!creator && creator.id === request?.creator_id;
```

`creator` comes from the `useAuth` hook, which fetches a row from the `creators` table. If that fetch is still in progress (or if there's a race condition between when the user clicks "Yes, published it" and when `creator` finishes loading), `isCreator` evaluates to `false` — and the entire `if (answer === "yes" && isCreator && requestId)` block is silently skipped.

No error is thrown. The feedback insert still works. The toast still shows. But `status` is never updated.

### The Fix

Replace the `isCreator` dependency inside `handlePublishAnswer` with a direct comparison using `user?.id` and `request?.creator_user_id` — or better, do a fallback: if `isCreator` is false but `user?.id` exists and the request is loaded, attempt the update anyway and let the RLS policy enforce access control server-side.

The simplest and most robust fix: inside `handlePublishAnswer`, guard on `user?.id` being present AND the `requestId` being present, and let Supabase's RLS deny the update if the user isn't the creator. This removes the client-side race condition entirely.

```typescript
// Before (race condition — can be false during async load):
if (answer === "yes" && isCreator && requestId) { ... }

// After (let the server enforce authorization, no client-side race):
if (answer === "yes" && requestId && user?.id) { ... }
```

If the user IS the creator, the RLS policy allows the update. If not, it returns an error which we already handle with `toast.error`. Zero behavioral difference for authorized users, eliminates the silent failure.

---

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Workspace.tsx` | Change `isCreator` guard to `user?.id` guard inside `handlePublishAnswer` — eliminates the async race condition that silently skips the status update |

No database changes. No new dependencies. No edge function changes.

### What about Declined/Cancelled tabs being empty?

Those are correctly empty — those rows have `hidden_by_creator: true` because the "delete" button was clicked on them at some point. The filter `.eq('hidden_by_creator', false)` correctly hides them. That behavior is working as designed.

### After this fix

To mark Raghav and James as published: open each workspace → the retrospective banner will appear (their dates are in the past) → click "Yes, we published it!" → status will now correctly save to `published` → they will appear in the Published tab.
