

## Redesign: "Membership" page replacing corporate "Subscription" page

Inspired by CarouselBot's "Forever Free" approach, this transforms the transactional subscription page into a warm membership recognition page.

### Changes

**1. Sidebar nav (`src/components/layout/DashboardLayout.tsx`)**
- Rename "Subscription" to "Membership" in the nav items array
- Keep the Crown icon and `/dashboard/subscription` path (no route change needed)

**2. Rewrite `src/pages/Subscription.tsx` with two distinct views:**

**View A: Founding Members / Active Pro users (`isPro && !isInTrial`)**
- Page title: "Membership" with Crown icon
- Large status card: "Founding Member" badge (for users without `stripe_customer_id`) or "Pro Member" badge (for paying subscribers)
- Warm copy: "You helped build DraftKit from day one. All Pro features are yours, forever." (founders) or "All features unlocked." (paid)
- Feature checklist styled as "Features Unlocked" (not a sales pitch) with check marks instead of feature icons
- "Manage Billing" button only shown if user has a `stripe_customer_id` (opens Stripe portal)
- Creator Discovery teaser kept as a subtle note

**View B: Free / Trial users**
- Page title: "Membership" 
- If in trial: warm banner showing days left
- Single clean upgrade card with billing toggle, price, features list, and "Upgrade to Pro" CTA
- Keep existing checkout logic intact

**3. `src/components/subscription/UpgradePrompt.tsx`**
- Update navigation text from "Upgrade to Pro" link text; no structural change needed since the route stays the same

**4. `src/components/subscription/ProBadge.tsx`**
- Add a "Founding Member" variant: when user is Pro without a Stripe customer ID, show "Founder" instead of "Pro" with a star/heart icon

### No database or backend changes required
All logic uses existing `usePro()` hook + `stripe_customer_id` check already in the Subscription page's `handleManage` function.

### Technical detail
- The founding member detection reuses the existing pattern: query `creators.stripe_customer_id` for the current user. If `isPro` is true but `stripe_customer_id` is null, they're a founder.
- This check will be lifted into a `useQuery` at the top of the component so both the status card and manage button can reference it.

