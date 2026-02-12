

# Add Subscription Page with Stripe Checkout

## Overview

Create a dedicated `/dashboard/subscription` page accessible from the sidebar, featuring a clean pricing card with $14.99/month and $149/year options, feature highlights, and Stripe checkout integration.

## Changes

### 1. Enable Stripe

Before any code changes, we need to enable the Stripe integration to collect the secret key and unlock Stripe-specific tools for creating products/prices.

### 2. Sidebar Navigation -- `DashboardLayout.tsx`

Add a "Subscription" nav item between "Settings" and the sign-out button:

```text
{ icon: Crown, label: "Subscription", path: "/dashboard/subscription" }
```

### 3. New Route -- `App.tsx`

Add route:
```text
<Route path="/dashboard/subscription" element={<Subscription />} />
```

### 4. New Page -- `src/pages/Subscription.tsx`

A clean, focused page with:

- **Pro status indicator**: If already Pro, show current plan details and management options
- **Pricing toggle**: Monthly ($14.99/mo) vs Yearly ($149/yr -- "2 months free")
- **Feature bullets**:
  - Unlimited Collaborative Workspaces
  - Floating Action Pill (The Editor)
  - Full Conversation History
  - AI-Powered First Drafts
  - Custom Profile Themes
- **"Early Access" badge**: "Includes future access to Creator Discovery tools"
- **CTA button**: "Start Pro" triggers Stripe Checkout
- **Visual savings callout**: Show "$12.42/mo billed annually" next to the yearly option

### 5. Stripe Products and Checkout

Using the Stripe integration tools (available after enabling):
- Create a "DraftKit Pro" product with two prices: $14.99 monthly recurring and $149 yearly recurring
- Create a checkout edge function that generates a Stripe Checkout session
- Handle success/cancel redirects back to the subscription page
- Webhook to update `creators.subscription_tier` to `'pro'` on successful payment

### 6. Update `UpgradePrompt.tsx` navigation

Change the upgrade destination from `/dashboard/settings?upgrade=true` to `/dashboard/subscription` so all upgrade CTAs (including the workspace view-only toast) route to the new page.

## Technical Details

### Files to create/modify

| File | Change |
|------|--------|
| `src/pages/Subscription.tsx` | New page with pricing UI |
| `src/components/layout/DashboardLayout.tsx` | Add "Subscription" to sidebar nav |
| `src/App.tsx` | Add `/dashboard/subscription` route |
| `src/components/subscription/UpgradePrompt.tsx` | Update navigate target |
| Edge function for Stripe checkout | Created via Stripe integration |

### Pricing structure

```text
+------------------+--------+------------------+
| Plan             | Price  | Display          |
+------------------+--------+------------------+
| Monthly          | $14.99 | "$14.99/mo"      |
| Yearly           | $149   | "$12.42/mo"      |
|                  |        | "billed annually"|
|                  |        | "Save $30.88"    |
+------------------+--------+------------------+
```

### Implementation order

1. Enable Stripe (required first -- unlocks tools and knowledge)
2. Create Stripe products/prices
3. Build the Subscription page UI
4. Wire up checkout + webhook
5. Update sidebar and upgrade prompts

