## What's actually happening

I checked your account, the edge function, the database, and Stripe. Three separate bugs are stacking on top of each other:

### 1. Preview is hitting LIVE Stripe (real charges)
Your last `create-checkout` call returned `https://checkout.stripe.com/c/pay/cs_live_...` — that's a **live** Checkout Session. The function only has `STRIPE_SECRET_KEY` configured (which is your live key), so every environment — preview, published, custom domain — uses live. That's why you got charged for real and why "pay again" wants real money again.

### 2. The webhook is not running — your tier never gets upgraded
- `stripe-webhook` edge function logs are **empty** (no Stripe event has ever hit it).
- `STRIPE_WEBHOOK_SECRET` is **not** in your secrets.
- Your `creators` row still shows `subscription_tier='free'` and `stripe_customer_id=NULL`, even though Stripe has a real customer (`cus_URfNFziXeDc2MK`) on `hello@elenacalvillo.com`.

So even after a successful payment, nothing wrote `subscription_tier='project'` back to the DB → `hasProjectAccess()` stays false → UI keeps showing "Upgrade to Project tier" → you click it again → Stripe creates *another* checkout session → "wants to charge me again."

### 3. Login loop after returning from Checkout
When Stripe redirects back, the success URL points at `/dashboard/subscription?success=true` but `window.open(url, "_blank")` opens a new tab. If you completed checkout in that new tab on a different (sub)domain (live `collabstack.lovable.app` vs the `id-preview--…` preview), your auth session doesn't follow → you land on `/login`. That's expected behavior of a cross-origin tab, not a data loss bug.

---

## The plan

### A. Stop charging real money in preview
Add a separate **test-mode Stripe secret + price IDs** and pick which set to use based on hostname.

1. Add new secrets:
   - `STRIPE_TEST_SECRET_KEY` (your Stripe test key, `sk_test_...`)
   - `PROJECT_TIER_TEST_PRICE_ID` (a test-mode price for $49/mo)
   - `PRO_MONTHLY_TEST_PRICE_ID`, `PRO_YEARLY_TEST_PRICE_ID` (test-mode prices for Pro)
2. In `create-checkout` and `customer-portal`, detect the request origin: if it contains `lovableproject.com` or `lovable.app` *preview* host (anything except `draftkit.app` / `collabstack.lovable.app`), use the test key + test price IDs. Otherwise live.
3. Same logic in `purchase-credits` and `stripe-webhook` (so a test webhook can use the test secret).

### B. Make tier upgrades actually persist (the real bug)
Two-pronged so we're never stuck again:

1. **Wire the webhook properly.**
   - In Stripe dashboard, register a webhook endpoint pointing at:
     - Live: `https://cbgchxesngdsvkevbqwh.supabase.co/functions/v1/stripe-webhook`
     - Test: same URL (Stripe sends test events when you use a test key)
   - Subscribe to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copy the signing secret(s) → add `STRIPE_WEBHOOK_SECRET` (live) and `STRIPE_WEBHOOK_SECRET_TEST` secrets.
   - Update `stripe-webhook` to pick whichever secret matches the event's livemode flag.

2. **Add a `check-subscription` fallback** so we don't depend solely on webhook delivery (recommended pattern). New edge function reads the user's live Stripe customer, finds the active subscription, maps the price to `pro` or `project`, and writes it back to `creators` (`subscription_tier`, `stripe_customer_id`, `stripe_subscription_id`). Idempotent.

3. **Poll on success.** When `Subscription.tsx` sees `?success=true` or `?pro_activated=true`, call `check-subscription` every 2s (max 10 tries) and refetch `usePro` until `tier !== 'free'`. Show "Activating your subscription…" while polling. This is the standard race-condition fix and avoids exactly your symptom (paid, but UI still shows upgrade).

### C. Open Checkout in the same tab
Replace `window.open(data.url, "_blank")` with `window.location.href = data.url` in `Subscription.tsx` (3 callers: `handleCheckout`, `handleProjectCheckout`, `handlePurchaseCredits`, plus `handleManageBilling`). This kills the cross-tab auth loop and matches the pattern Stripe recommends for hosted Checkout.

### D. Recover the payment you just made
You already paid live. Plan steps to clean up:

1. I'll fetch your live Stripe subscription via `stripe--list_subscriptions` for `cus_URfNFziXeDc2MK`.
2. If a `project`-priced subscription exists and is active, write a one-shot migration that sets your creator row's `subscription_tier='project'`, `stripe_customer_id='cus_URfNFziXeDc2MK'`, `stripe_subscription_id=<sub_id>`. (No new charge — this just records what you already paid for.)
3. After the webhook is wired, future events will keep this in sync automatically.

If for some reason the subscription isn't there or you'd prefer a refund + re-pay in test mode first, say the word and I'll cancel + refund via Stripe tools instead.

---

## Files I'll touch

```
supabase/functions/create-checkout/index.ts       — env routing (test/live)
supabase/functions/customer-portal/index.ts        — env routing
supabase/functions/purchase-credits/index.ts       — env routing
supabase/functions/stripe-webhook/index.ts         — pick secret by livemode
supabase/functions/check-subscription/index.ts     — NEW: pull-based sync
src/pages/Subscription.tsx                         — same-tab redirect + polling
supabase/migrations/<ts>_recover_project_tier.sql  — one-shot DB fix for your row
```

## What I need from you before building

Two secrets, in this order:

1. `STRIPE_TEST_SECRET_KEY` — your Stripe **test** secret key (`sk_test_…`). Get it from Stripe dashboard → toggle "Test mode" on (top right) → Developers → API keys.
2. After it's added, I'll create the test-mode Project / Pro prices via Stripe MCP and put the resulting `price_…_test` IDs into `PROJECT_TIER_TEST_PRICE_ID`, `PRO_MONTHLY_TEST_PRICE_ID`, `PRO_YEARLY_TEST_PRICE_ID`.
3. `STRIPE_WEBHOOK_SECRET` (live) and `STRIPE_WEBHOOK_SECRET_TEST` once we register the endpoint in both modes.

When you approve, I'll start with steps A+B+C in the same pass so preview is safe to test, then run D against your live Stripe data to recover the $49 you already paid.
