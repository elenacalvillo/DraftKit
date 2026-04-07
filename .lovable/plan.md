

# Integrated Membership: Pricing Fix + Credit Foundation

## Overview

Fix the broken pricing math, add a `credits` column to the database, seed 3 credits for new users, and add one-time credit top-up buttons to the Membership page. No gating yet — just the financial foundation.

## Step 1: Fix the Yearly Stripe Price

The current yearly price is $149.00 (`price_1Szs8KAgAh00fVW1sKwidi8l`). It needs to be $149.90 to give exactly 2 months free.

- Create a new Stripe price on the existing product (`prod_Txnjt0JKCsMyCP`): $149.90/year
- Update `YEARLY_PRICE_ID` in `Subscription.tsx` to the new price ID
- The old $149 price remains in Stripe but is no longer referenced

## Step 2: Fix Display Math in `Subscription.tsx`

- Yearly display: `$12.49/mo` (was `$12.42`)
- Annual note: `$149.90 billed annually — 2 months free` (was `$149`)
- Save badge: `Save $29.98` (was `Save $30`)

## Step 3: Database — Add Credits Column

Migration:

```sql
ALTER TABLE public.creators ADD COLUMN credits integer NOT NULL DEFAULT 3;
```

All existing users get 3 credits. New users auto-get 3 via the default.

## Step 4: Create Stripe Credit Pack Products

Two one-time products:
- **10 Credits** — $10.00 one-time
- **30 Credits** — $25.00 one-time

## Step 5: Create `purchase-credits` Edge Function

A new edge function that:
- Accepts a `packId` (maps to a price ID)
- Creates a one-time Stripe checkout session (`mode: "payment"`)
- On `success_url`, includes `?credits_purchased=10` or `?credits_purchased=30`
- Returns the checkout URL

## Step 6: Credit Fulfillment via `success_url` Parameter

When the user returns to `/dashboard/subscription?credits_purchased=10`:
- The Subscription page detects the param
- Calls a new `fulfill-credits` edge function that verifies the Stripe session and increments `creators.credits`
- Shows a success toast

The `fulfill-credits` function:
- Takes a Stripe checkout session ID
- Verifies payment is `paid`
- Reads quantity from session metadata
- Increments credits using a service-role update
- Returns updated credit count

## Step 7: Update Membership Page UI

Add a "Need a quick boost?" section below the subscription card for free/trial users:

```text
┌─────────────────────────────────┐
│  Need a quick boost?            │
│                                 │
│  ┌──────────┐  ┌──────────────┐ │
│  │ 10 for   │  │ 30 for $25   │ │
│  │ $10      │  │ Best value   │ │
│  └──────────┘  └──────────────┘ │
│                                 │
│  You have X credits remaining   │
└─────────────────────────────────┘
```

- Show current credit balance (queried from `creators.credits`)
- Two buttons trigger `purchase-credits` with the respective pack
- Pro members see their credit balance but with a note that credits aren't consumed on Pro

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `credits` column to `creators` |
| `src/pages/Subscription.tsx` | Fix pricing math, add credit balance display, add top-up section |
| `supabase/functions/purchase-credits/index.ts` | New: one-time Stripe checkout for credit packs |
| `supabase/functions/fulfill-credits/index.ts` | New: verify payment + increment credits |
| Stripe | New yearly price $149.90, two one-time credit pack products |

