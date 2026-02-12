
# Smart "Manage" Button: Three Paths, Zero Errors

## Changes (single file: `src/pages/Subscription.tsx`)

### 1. Smart `handleManage` with three paths

The function will check the user's state before making any network call:

```text
Click "Manage" ->
  Path A: !isPro          -> smooth-scroll to pricing card
  Path B: isPro + no stripe_customer_id -> toast "Founding member, no billing needed"
  Path C: isPro + stripe_customer_id    -> open Stripe Customer Portal
```

- Query `creators.stripe_customer_id` for the current user
- If null and isPro: friendly founding-member toast
- If null and !isPro: scroll to pricing section
- If exists: call `customer-portal` edge function as before

### 2. Button always visible with dynamic label

- Move the button out of the `isPro` banner so ALL users see it
- Place it below the pricing card as a secondary action
- Label changes based on state:
  - Free users: "View Plans" (scrolls to pricing)
  - Pro users: "Manage Billing"
- The Pro banner keeps its current layout but without the button

### 3. Add `id="pricing"` anchor to pricing card

Add `id="pricing"` to the pricing `Card` so free users get smooth-scrolled there.

---

## Technical detail

**File:** `src/pages/Subscription.tsx`

- **Line 68-85**: Replace `handleManage` with the three-path version that queries `creators.stripe_customer_id` first
- **Lines 120-124**: Remove the Manage button from the Pro banner
- **Line 130**: Add `id="pricing"` to the pricing Card
- **After line 207**: Add a universal button below the pricing card with dynamic label (`isPro ? "Manage Billing" : "View Plans"`)
