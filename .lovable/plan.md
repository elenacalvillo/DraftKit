## 3-Stage Retention Campaign + DAR Fix

### 1. Database changes (migration)

Add to `creators`:

- `last_nudge_sent_at timestamptz null`
- `nudge_count integer not null default 0`

To detect "inactive" users we need `last_sign_in_at`, which lives in `auth.users` (not directly readable from the client). Add a `SECURITY DEFINER` admin-only RPC:

```sql
create or replace function public.get_inactive_credit_users()
returns table(
  user_id uuid, creator_id uuid, name text, email text,
  credits int, nudge_count int, last_nudge_sent_at timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.user_id, c.id, c.name, u.email, c.credits,
         c.nudge_count, c.last_nudge_sent_at, u.last_sign_in_at
  from creators c
  join auth.users u on u.id = c.user_id
  where c.credits > 0
    and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '7 days')
    and public.has_role(auth.uid(), 'admin')
    and c.nudge_count < 3
  order by u.last_sign_in_at asc nulls first;
$$;
```

Plus an admin-only RPC `bump_nudge_count(_creator_id uuid)` that sets `last_nudge_sent_at = now()` and `nudge_count = nudge_count + 1` (guarded by `has_role(auth.uid(),'admin')` and a same-day re-send block).

### 2. Admin Dashboard — "Inactive User Campaign" table

In `src/pages/AdminAnalytics.tsx`, add a new section below the existing tables:

- Columns: Name · Email · Credits · Last login (relative) · Nudges sent · Action
- Action column renders one button based on `nudge_count`:
  - `0` → "Send Strike 1 (Value Debt)"
  - `1` → "Send Strike 2 (New Feature)"
  - `2` → "Send Strike 3 (Final Check-in)"
  - `3` → muted "Campaign complete"
- Disable the button if `last_nudge_sent_at` is within the last 24h (prevents same-day double-send).
- Click handler:
  1. Build the email body (template below) with `[X]` replaced by `credits` and a personalized greeting using first name.
  2. Copy `Subject\n\nBody` to clipboard via `navigator.clipboard.writeText`.
  3. Call `bump_nudge_count` RPC, refetch the list, toast `"Strike N copied — paste into your email client"`.

Email templates (Strike 1–3) use the exact copy from the brief. Ensure the `bump_nudge_count` RPC also returns the updated row so the Admin UI reflects the change instantly without a full page reload.



### 3. DAR fix in `AdminAnalytics.tsx`

Current math counts `draft_accepted` events (line 246) — change to unique `request_id`s:

```ts
const acceptedRequestIds = new Set(
  events
    .filter(e => e.event_type === "draft_accepted")
    .map(e => (e.event_data as any)?.request_id)
    .filter(Boolean)
);
const draftAccepted = acceptedRequestIds.size;
```

Denominator stays `total_drafts_generated` (count of `draft_generated` events). Add a small caption under the metric: "unique drafts copied or downloaded ÷ drafts generated".

### 4. SharedWorkspace toast + tracking

`draft_accepted` is already fired from both Copy (line 216) and Download (line 235) — confirmed correct. Only change:

- Update the Copy success toast (line 214) from `"Draft copied — paste it into Substack. You just saved ~30 minutes."` to **"Draft copied — you just saved ~30 minutes."** to match the brief verbatim.
- Add the same toast text on Download success for consistency: `"Draft downloaded — you just saved ~30 minutes."`

### Open questions

1. Email "from" / signature — should the copied draft include a signature line (e.g. "— Sam") or leave it blank for the admin to paste their own?
2. Subject lines — the brief gives bodies only. Suggested: S1 "Quick one about your DraftKit credits", S2 "Saving ~30 min per post", S3 "Last check-in". OK?
3. The brief calls the column `credits_balance` and `last_login` — actual DB has `creators.credits` and `auth.users.last_sign_in_at`. Plan uses the real columns.

### Files touched

- migration (new) — add columns + 2 RPCs
- `src/pages/AdminAnalytics.tsx` — DAR math, new campaign section, RPC calls
- `src/components/requests/SharedWorkspace.tsx` — toast copy tweak (Copy + Download)
- new `src/lib/nudge-templates.ts` — email body builder for the 3 strikes