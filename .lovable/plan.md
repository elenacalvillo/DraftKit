# Close the analytics blind spots

## Problem

You're right — we have growth loops shipped (referrals, invite-to-signup, Discovery, credit grants) but the dashboard can't tell us which loop is firing. Today we only track ~30 events and most of them are clustered around one surface (the Workspace + draft flow). Whole product surfaces have **zero clicks tracked**:

- **Discovery page** — we show "X writers registered" but don't know if anyone clicks profiles, opens a Substack, or sends an invite from there.
- **Invite-driven signups** — `user_signup` fires, but we don't capture *how* the user arrived (invited collaborator? referral link? cold landing?), so attribution is impossible.
- **Referral / credit loop** — no event when a user copies their referral link, lands via `?ref=`, or earns a credit.
- **Membership / upgrade funnel** — upgrade prompts shown vs. clicked vs. checkout started vs. completed are not stitched.
- **Dashboard navigation** — we can't see which dashboard tiles/CTAs people actually use.
- **Email → app** — broadcast and reminder emails don't tag inbound clicks, so we can't measure re-engagement.

The Admin dashboard then can't slice "which features are used" because the events don't exist.

## Plan

### 1. Add the missing event types
`src/hooks/useAnalytics.ts` — extend `AnalyticsEventType` with:

- Attribution & growth loops
  - `signup_attribution` (fired once on signup with `{ source: "invite" | "referral" | "discovery" | "landing" | "direct", invite_request_id?, referrer_user_id? }`)
  - `referral_link_copied` (`{ surface }`)
  - `referral_visit` (when `?ref=` lands; deduped per session)
  - `referral_credit_earned` (mirror of the DB trigger so it shows in the event stream)
  - `invite_email_clicked` (from email UTM landing)
- Discovery surface
  - `discovery_opened`, `discovery_filter_applied` (`{ filter, value }`), `discovery_profile_viewed` (`{ target_username }`), `discovery_substack_opened`, `discovery_invite_clicked`, `discovery_waitlist_signup` (rename of existing `directory_waitlist_signup` for consistency — keep the old one as alias for back-compat)
- Membership / monetization funnel
  - `upgrade_prompt_shown` (`{ surface, reason }`), `upgrade_prompt_clicked`, `checkout_started` (`{ plan }`), `checkout_completed` (from Stripe webhook → insert via service role), `credits_purchase_started`, `credits_purchase_completed`
- Dashboard / navigation
  - `dashboard_tile_clicked` (`{ tile }`), `nav_link_clicked` (`{ link }`) — wired through `NavLink` and dashboard cards so we don't have to sprinkle handlers
- Email loop
  - `email_link_clicked` — fired on landing pages when a `utm_source=email` query param is present

No DB migration needed; `analytics_events` already accepts arbitrary `event_type`.

### 2. Wire the events at call sites
- **`src/pages/Signup.tsx`** — read `sessionStorage` for invite/referral context (set by `PublicBooking` invite landings and `?ref=` handler) and emit `signup_attribution` right after `user_signup`.
- **`src/components/auth/PostAuthRedirect.tsx`** — same attribution emission for OAuth signups (first-login detection).
- **`src/pages/Discovery.tsx`** — wrap profile click, "Open Substack", "Invite", filter changes with `trackEvent`.
- **`src/pages/PublicBooking.tsx`** — capture `?ref=` / `?invited_by=` into sessionStorage on mount; fire `referral_visit` once per session.
- **`src/pages/Subscription.tsx` / `UpgradePrompt.tsx` / `ProjectUpgradePrompt.tsx`** — `upgrade_prompt_shown` on mount, `upgrade_prompt_clicked` and `checkout_started` on CTA.
- **`src/pages/Dashboard.tsx` + `NavLink.tsx`** — small `useTrackedClick` helper that fires `dashboard_tile_clicked` / `nav_link_clicked` without changing visual code.
- **`supabase/functions/stripe-webhook/index.ts`** — insert `checkout_completed` / `credits_purchase_completed` into `analytics_events` so revenue events live in the same stream.
- **Referral copy** — wherever the referral link is shown (Subscription / Dashboard), wrap copy with `referral_link_copied`.

### 3. Surface it in AdminAnalytics
`src/pages/AdminAnalytics.tsx` — add three new sections without removing existing ones:

1. **Feature Usage Matrix** — table of every event type with: 7d count, 30d count, unique users, % of WAU. Lets you see at a glance which features are dead vs. alive.
2. **Growth Loop Funnels** — three small funnel cards:
   - *Referral loop*: `referral_visit` → `user_signup` (attributed=referral) → `draft_accepted`
   - *Invite loop*: `invite_email_clicked` → `user_signup` (attributed=invite) → `workspace_opened` → `draft_accepted`
   - *Discovery loop*: `discovery_opened` → `discovery_profile_viewed` → `discovery_invite_clicked` → resulting `collab_approved`
3. **Signup Attribution Pie** — % of new accounts by `signup_attribution.source` over selected window. This is the single number that answers "are growth loops working?".

Existing Draft Acceptance Rate and funnel stay untouched.

### 4. Backfill note (call out, don't build)
Past signups won't have `signup_attribution`. The new funnels start from "today forward". We'll mark pre-rollout users as `source: "unknown"` in the UI rather than back-filling.

## Files touched

- `src/hooks/useAnalytics.ts` — event type union
- `src/pages/Signup.tsx`, `src/components/auth/PostAuthRedirect.tsx` — attribution emission
- `src/pages/PublicBooking.tsx` — capture ref/invite params
- `src/pages/Discovery.tsx` — surface tracking
- `src/pages/Subscription.tsx`, `src/components/subscription/UpgradePrompt.tsx`, `src/components/projects/ProjectUpgradePrompt.tsx` — monetization funnel
- `src/pages/Dashboard.tsx`, `src/components/NavLink.tsx` — nav/tile clicks
- `supabase/functions/stripe-webhook/index.ts` — server-side checkout events
- `src/pages/AdminAnalytics.tsx` — Feature Usage Matrix, Growth Loop Funnels, Attribution Pie

## Out of scope

- A/B framework, cohort retention curves, Mixpanel/PostHog migration. We can revisit once the new events have ~2 weeks of baseline data.

Approve and I'll ship it.
