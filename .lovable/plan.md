## Goal

Recreate the 5 live Stripe products in test mode with identical pricing, then store the resulting test price IDs as runtime secrets so `create-checkout` and `purchase-credits` can route preview traffic to test mode (already partially scaffolded in `.lovable/plan.md`).

## Live catalog discovered

| Product | Live price ID | Amount | Interval |
|---|---|---|---|
| DraftKit Project Tier | `price_1TSknqAgAh00fVW1Opx4dfq7` | $49.00 | monthly |
| DraftKit Pro (monthly) | `price_1Szs8CAgAh00fVW11BjTnSrF` | $14.99 | monthly |
| DraftKit Pro Annual | `price_1TJRLwAgAh00fVW16vp9a32v` | $149.90 | yearly |
| 10 Credits | `price_1TJRKFAgAh00fVW1m8vAQsbZ` | $10.00 | one-time |
| 30 Credits | `price_1TJRKGAgAh00fVW1KtRO3lEe` | $25.00 | one-time |

(Note: `purchase-credits/index.ts` currently swaps the IDs — `"10"` points at price `…m8vAQsbZ` ($10) and `"30"` points at `…KtRO3lEe` ($25). Mapping is consistent with amounts; will preserve when mirroring.)

## Steps

### 1. Switch the Stripe MCP key to test mode
Use `stripe--update_stripe_secret_key` to point the MCP tools at `STRIPE_TEST_SECRET_KEY` (already in your secrets). Required because `create_stripe_product_and_price` writes to whichever account the key targets.

### 2. Create 5 test-mode products + prices (one call each)
Using `stripe--create_stripe_product_and_price`:

1. `DraftKit Project Tier` — 4900 USD, recurring `month`
2. `DraftKit Pro` — 1499 USD, recurring `month`
3. `DraftKit Pro Annual` — 14990 USD, recurring `year`
4. `10 Credits` — 1000 USD, one-time
5. `30 Credits` — 2500 USD, one-time

### 3. Store the new test price IDs as runtime secrets
Via `add_secret`:

- `PROJECT_TIER_TEST_PRICE_ID`
- `PRO_MONTHLY_TEST_PRICE_ID`
- `PRO_YEARLY_TEST_PRICE_ID`
- `CREDITS_10_TEST_PRICE_ID`
- `CREDITS_30_TEST_PRICE_ID`

### 4. Restore the live key in MCP
Switch `stripe--update_stripe_secret_key` back to `STRIPE_SECRET_KEY` so future MCP calls don't accidentally hit the test account.

### 5. (Out of scope here, but flagged) Wire the edge functions
`create-checkout`, `purchase-credits`, `customer-portal`, and `stripe-webhook` still need the host-based test/live routing logic from `.lovable/plan.md` section A. This plan only covers populating the catalog + secrets — say the word and I'll do the routing wiring in a follow-up pass.

## What you don't need to do
Nothing. All 5 products + secrets will be created via tools. You already added `STRIPE_TEST_SECRET_KEY`.
