## The situation

Today, access to Book Projects is controlled by `hasProjectAccess()` in `src/lib/access.ts`, which returns `true` only when `creators.subscription_tier === 'project'`. That's the right architecture — but two things are wrong in practice:

1. **Founding Members are *not* automatically getting Projects.** Their tier is `pro` (or granted via the `pro` role), not `project`. So you, as a Founding Member, do **not** currently have access. Good — that matches what you want.
2. **But the Membership page (`/dashboard/subscription`) hides the Project tier upgrade card from anyone who is already Pro/Founder.** `Subscription.tsx` early-returns View A for `isPro && !isInTrial`, which is why you can't see any "Upgrade to Project tier" button. That's the screenshot you're looking at.

So the policy you want is already enforceable; the UI just doesn't expose the upsell to existing Pro members.

## What this plan does

### 1. Confirm the access policy (no code change, just documentation)

- Free → no Pro, no Projects
- Pro (paid or Founding Member) → Pro features only, **no** Book Projects
- Project ($49/mo) → superset of Pro, **plus** Book Projects (chapters, members, broadcasts, 1 GB image storage)

This is already what `hasProjectAccess()` enforces. No DB or gate changes needed.

### 2. Surface the Project upgrade card to Pro & Founding Members

In `src/pages/Subscription.tsx`, the "View A" branch (Founders / paid Pro) currently shows: status card, features list, credits, Creator Discovery teaser, Manage Billing. Add a **"Add Book Projects — $49/mo"** card to View A, between the features list and the credits section, that:

- Explains Book Projects are an add-on tier (chapters, roles, broadcasts, 1 GB images).
- Notes clearly: "Founding Member benefits don't include Book Projects — this is a separate tier."
- Has an "Upgrade to Project tier" button that calls the existing `handleProjectCheckout()` (already wired to Stripe + `PROJECT_TIER_PRICE_ID`).
- Is only shown when the user is **not** already on the `project` tier (use `tier !== 'project'` from `usePro()`).

For users already on `project`, replace the card with a small confirmation badge ("Book Projects active").

### 3. Make the gate visible everywhere else

- `ProjectUpgradePrompt.tsx` is already shown on `/dashboard/projects` and `ProjectDetail.tsx` for non-project tiers, including Founders. Verify the copy reflects that this is a paid add-on (not "upgrade to Pro"). Tweak the heading to "Book Projects are a paid add-on" and keep the CTA pointing at `/dashboard/subscription?plan=project`.
- Sidebar/nav: if a "Projects" entry is shown to Pro/Free users, leave it visible (it routes to the upsell screen). No change needed unless you'd prefer to hide it entirely — let me know.

### 4. Clarify Founding Member copy

Update the Founding Member status card copy from:

> "You helped build DraftKit from day one. All Pro features are yours, forever."

to keep the same warmth but set the expectation:

> "You helped build DraftKit from day one. All Pro features are yours, forever. Book Projects are a separate add-on tier."

## Files touched

- `src/pages/Subscription.tsx` — add Project upgrade card to View A; tweak Founding Member copy.
- `src/components/projects/ProjectUpgradePrompt.tsx` — sharpen heading/subhead so it reads as a paid add-on, not a Pro upsell.

No DB migrations, no edge function changes, no Stripe changes — the `PROJECT_TIER_PRICE_ID` and `create-checkout` flow are already in place from the previous round.

## Out of scope (flag if you want them)

- Granting any specific Founding Members complimentary Project access (would need a per-user override; not done by default).
- Hiding the Projects nav entry entirely for non-project users.
- Building a downgrade/cancel flow specific to the Project tier (today it routes through the standard Stripe customer portal).
