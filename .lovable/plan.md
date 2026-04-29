## What I found (and what I did NOT find)

I did NOT touch any code. I read the database, recent migrations, and the message-send code paths. Here is the honest picture:

### 1. Messages ARE flowing on the server

The `collaboration_messages` table has Dinah's most recent message timestamped **April 27 13:16 UTC** (2 days ago). 17 total messages from her account. So the table itself is healthy and her account has historically been able to insert.

### 2. No DB errors, no edge function errors

- Postgres logs: zero `ERROR`/`FATAL` entries mentioning `collaboration_messages` or `RLS`/`denied` in the last 48 hours.
- Edge function logs: empty for `send-collab-email` (it is fire-and-forget anyway, so a failure there would not block the modal).

### 3. The real risk: the security migrations stripped grants on `creators`

Between April 28 and 29, six migrations rewrote policies/grants on `public.creators` to fix the "Stripe columns publicly readable" finding. The current state:

```
authenticated  →  has_table_privilege(creators, SELECT) = false
anon           →  has_table_privilege(creators, SELECT) = false
```

Column-level grants exist for safe columns (`id`, `user_id`, `name`, `username`, etc.), so the JOIN inside `collaboration_messages`' INSERT policy:

```
WITH CHECK (request_id IN (
  SELECT cr.id FROM collab_requests cr
  JOIN creators c ON cr.creator_id = c.id
  WHERE c.user_id = auth.uid()
))
```

…technically still works because `id` and `user_id` are column-granted. **But this is fragile.** Any future migration that omits a column from the grant list silently breaks message sending for creators. This is the exact "zombie policy" pattern that has bitten us twice already.

### 4. What I cannot tell from here

I do not have a captured browser console error or network trace from Dinah's session showing the actual failure mode. Without that I am guessing whether:
- (a) the Send button hangs (insert silently fails), or
- (b) the modal does not open (UI state issue), or
- (c) the message sends but the conversation panel does not refresh (React Query cache issue from yesterday's fix).

## The plan: one small, targeted change + a verification step

### Step 1 — Make `collaboration_messages` policies independent of `creators` grants

Replace the two creator-side policies that JOIN to `creators` with policies that use the existing `is_request_owner(auth.uid(), request_id)` SECURITY DEFINER helper. That helper already exists, is already used by `workspace_collaborators` policies, and bypasses the column-grant fragility.

```sql
DROP POLICY "Creators can insert messages for their requests" ON collaboration_messages;
DROP POLICY "Creators can view messages for their requests"   ON collaboration_messages;

CREATE POLICY "Creators can insert messages for their requests"
  ON collaboration_messages FOR INSERT TO authenticated
  WITH CHECK (is_request_owner(auth.uid(), request_id));

CREATE POLICY "Creators can view messages for their requests"
  ON collaboration_messages FOR SELECT TO authenticated
  USING (is_request_owner(auth.uid(), request_id));
```

Same change for the equivalent policies on `collab_requests` if they show the same fragile JOIN pattern (I will verify per-policy in the migration, not blindly).

This removes the dependency on `creators` table grants entirely. Whatever future security pass we run, message sending stays intact.

### Step 2 — Verify before declaring victory

After the migration runs, I will:

1. Re-run the `has_table_privilege` check to confirm policies no longer require it.
2. Query `collaboration_messages` to confirm no rows were lost.
3. Ask you to have Dinah send one test message and report the outcome (or paste her browser console + network tab if it still fails).

### Step 3 — If Dinah's issue is NOT this

Then I need her browser console error or a network 4xx/5xx response. I will not blindly add more code. The exact next debug step depends on which of (a)/(b)/(c) above is happening.

## What I will NOT do in this pass

- I will NOT touch React Query caching (yesterday's change is not implicated by any data I can see).
- I will NOT touch the email edge function (it is fire-and-forget and not blocking the insert).
- I will NOT add new policies, new tables, or new RPCs.
- I will NOT re-run the security scanner or "fix" any other findings.

One file changed (one migration). Roll-back is one DROP POLICY + recreate.

## Honest cost estimate

- 1 short migration (~15 lines).
- 1 verification query.
- Zero frontend changes.

If after the migration Dinah still cannot send, the next step is **read her console log** — not write more code.

Approve and I will execute exactly this and nothing more.