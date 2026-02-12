

# Strategic Enhancements to Subscription Flow

Three targeted improvements to make the subscription experience feel premium and conversion-optimized.

## 1. Automatic Tax Calculation

Add `automatic_tax: { enabled: true }` to the Stripe Checkout session in the `create-checkout` edge function. This handles RFC/IVA and other regional tax requirements automatically -- no manual tax logic needed.

**File:** `supabase/functions/create-checkout/index.ts`
- Add `automatic_tax: { enabled: true }` to the `stripe.checkout.sessions.create()` call

## 2. Pro Badge in Sidebar

Show the existing `ProBadge` component next to the creator's name in the sidebar once they're on Pro. The `ProBadge` component already exists and is used in Settings -- we just need to wire it into the sidebar user info section.

**File:** `src/components/layout/DashboardLayout.tsx`
- Import `usePro` hook and `ProBadge` component
- Add `ProBadge` next to the creator name in the sidebar footer (lines 181-189), only when `isPro` is true
- Small, elegant placement right after the name

## 3. Success State After Checkout

When the user returns from Stripe with `?success=true`, show a celebratory toast and a visual success banner on the Subscription page.

**File:** `src/pages/Subscription.tsx`
- Read `?success=true` from URL params on mount via `useSearchParams`
- Show a toast: "Welcome to the Engine. Your workspace is now unlocked."
- Optionally pass a `returnTo` URL through the checkout flow so the success redirect can send them back to the workspace they came from

### Redirect-back-to-workspace flow

- Update `UpgradePrompt` and workspace view-only toasts to pass the current path as a query param when navigating to `/dashboard/subscription`
- Pass that `returnTo` value through to the checkout edge function, which appends it to the Stripe `success_url`
- On success return, redirect the user back to their workspace instead of staying on the subscription page

## Technical Details

| File | Change |
|------|--------|
| `supabase/functions/create-checkout/index.ts` | Add `automatic_tax` to session config |
| `src/components/layout/DashboardLayout.tsx` | Import `usePro` + `ProBadge`, show badge next to name |
| `src/pages/Subscription.tsx` | Handle `?success=true` with toast + optional redirect |
| `src/components/subscription/UpgradePrompt.tsx` | Pass `returnTo` param when navigating |

### Implementation order

1. Update `create-checkout` edge function with `automatic_tax`
2. Add Pro badge to sidebar
3. Add success state handling to Subscription page
4. Wire up returnTo redirect flow

