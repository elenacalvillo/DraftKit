# Fix: Guest Can't See Approved Collabs or Access Workspace

## Root Cause

In `PublicBooking.tsx` line 544, `requester_user_id` is hardcoded to `null` — even when the guest is logged in. This breaks the entire guest experience:

- **Proposals page** (MyRequests) queries by `requester_user_id = user.id` → returns nothing
- **RLS policies** for SELECT, UPDATE, workspace editing all check `requester_user_id = auth.uid()` → blocked
- **Workspace page** can't load the request → guest is locked out

## The Fix

### 1. Set `requester_user_id` when the guest is logged in

**File:** `src/pages/PublicBooking.tsx` (line 544)

Change `requester_user_id: null` to `requester_user_id: user?.id ?? null` — the `user` object is already available from the `useAuth()` hook used in this component. This ensures future requests are properly linked.

### 2. Backfill the existing broken request

**SQL migration:** Update the existing request where `requester_email = 'elenacalvilloalcalde@gmail.com'` and `requester_user_id IS NULL` to set `requester_user_id = 'ce0504e4-1772-4345-8bb2-e9909eedba4c'`. This fixes Elena Tester's current approved collab immediately.

Actually, make this more robust: backfill ALL requests where `requester_user_id IS NULL` but the `requester_email` matches a known auth user email. This catches any past requests from registered users.

### 3. Auto-link on future logins (prevent drift)

**SQL trigger:** Create a trigger function that runs on `auth.users` login or on `collab_requests` read — actually, the simplest approach: create a database function `backfill_requester_user_id()` and a trigger on `creators` insert (when a new user signs up, link any prior requests by email). This ensures that if someone submits a request as a guest and later signs up, their requests get linked.

The plan looks good. Run the fix and the SQL backfill. However, also verify the RLS policies for the `workspaces` and `workspace_members` tables. Ensure that when a `requester_user_id` is finally linked, they automatically gain 'Read/Write' access to the workspace created for that collab.

## Files to Change


| File                          | Change                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `src/pages/PublicBooking.tsx` | Set `requester_user_id: user?.id ?? null` (2 occurrences on lines 544 and 568)    |
| SQL migration                 | Backfill existing null `requester_user_id` values by matching email to auth users |
| SQL migration                 | Add trigger on `creators` INSERT to auto-link prior guest requests by email       |


## Impact

After this fix:

- Elena Tester will immediately see the approved collab in her Proposals page
- She can enter the workspace and start drafting
- All future logged-in guests will be properly linked
- Past guests who later sign up will have their requests auto-linked