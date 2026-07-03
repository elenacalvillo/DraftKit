## Diagnosis

**Issue 1 — Elena expected the "Projects" sidebar item to appear on the shewritesai account after upgrading it to "pro".**

Root cause: it's a tier mismatch, not a bug.

- The DB row for `shewritesai` (creator `4c575634…`) is set to `subscription_tier = 'pro'`.
- The sidebar "Projects" entry (`DashboardLayout.tsx`) is gated by `isProject`, which in `hasProjectAccess()` requires `subscription_tier === 'project'` — strictly. `pro` is the newsletter tier; `project` is the superset that unlocks Book Projects.
- So the account correctly does NOT see Projects today.

**Issue 2 — Angela (collabs@shewritesai.org feedback about "Angela lost her Google Workspace email").**

- `collab_requests.6eb97d92…` shows Angela came in as a guest: `requester_email = angela@thepunchlab.com`, `requester_user_id = NULL`.
- She never created a DraftKit account — there is nothing to "unlock". She was an off-platform guest whose email address is now dead, which is why she couldn't be invited/receive links and shared the file with Elena directly.
- No account recovery is possible or needed. If Elena wants Angela back on the workspace with a working email, Angela signs up with her new address and Elena re-invites her; the existing `link_collaborator_on_insert` trigger will attach her to any pending invite that matches.

## Plan

### 1. Data fix: upgrade shewritesai from `pro` → `project`

Single migration:

```sql
UPDATE public.creators
SET subscription_tier = 'project',
    updated_at = now()
WHERE id = '4c575634-453d-4c92-afd4-180d3411037e';
```

After this, on the next auth refresh the sidebar picks up `isProject = true` and the "Projects" entry appears between Network and Settings, exactly as intended. No code changes required.

Verification steps I'll run right after the migration:
- `SELECT subscription_tier FROM creators WHERE id = '4c575634…'` → expect `project`.
- Ask Elena to hard-refresh shewritesai; `usePro().isProject` will be `true` because `hasProjectAccess()` returns true for `tier = 'project'` with no trial cap.

### 2. Reply to the Angela feedback

No code change. Suggested reply for Elena to send from the feedback thread:

> Thanks for flagging — Angela came in as an off-platform guest (her Google Workspace email was on the invite, but she never created a DraftKit account), so there's nothing locked on our side. Whenever she has a new working email, sign her back up and re-invite her from the workspace — our system will auto-link her to any pending invites tied to that address.

### 3. Optional guardrail (only if you want it now)

To make the "I upgraded them but Projects didn't show up" mistake impossible in the future, we could:

- Add a small admin/settings toggle for "grant Project tier" so upgrading a user always sets `subscription_tier = 'project'` (or `pro`) explicitly, not by hand-editing SQL.
- OR relabel: rename the DB value `pro` → `newsletter_pro` and `project` → `book_project` so the intent is obvious in the row.

I'd recommend deferring both; they're polish, not fixes. Say the word if you want either in this same change.

## What this plan does NOT touch

- No changes to `usePro`, `access.ts`, `DashboardLayout.tsx`, RLS, or any edge functions — the current gating logic is correct and matches the memory rule that Project tier is a superset of Pro.
- No email/DNS or auth recovery changes for Angela — nothing to recover.
