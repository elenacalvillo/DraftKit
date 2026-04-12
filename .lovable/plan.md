

# Add Terms of Service and Refund Policy Pages

## What Changes

### 1. Create two new pages

**`src/pages/TermsOfService.tsx`** — Uses the same glass-card aesthetic as `/privacy` (icon sections, motion animations, Navbar, back-to-home link, bottom CTA). Content covers: Account responsibility, IP ownership, Stripe as payment processor, Pro vs Free tiers, Writer's Credits (no cash value), conduct rules, liability disclaimer.

**`src/pages/RefundPolicy.tsx`** — Same layout. Content covers: Subscription cancellation (no partial refunds), credits are final, technical error fix/refund guarantee, abuse exclusion, contact email.

### 2. Register routes (`src/App.tsx`)

Add `/terms` and `/refund-policy` routes pointing to the new page components.

### 3. Add footer links (`src/components/layout/Footer.tsx`)

Add "Terms of Service" and "Refund Policy" links in the footer links section alongside Privacy Policy and Transparency.

### 4. Add legal links near checkout (`src/pages/Subscription.tsx`)

Add a small text line near the subscribe/purchase buttons: "By continuing, you agree to our Terms of Service and Refund Policy" with links.

## Files

| File | Change |
|------|--------|
| `src/pages/TermsOfService.tsx` | New — glass-card legal page with provided content |
| `src/pages/RefundPolicy.tsx` | New — glass-card legal page with provided content |
| `src/App.tsx` | Add two route entries + imports |
| `src/components/layout/Footer.tsx` | Add Terms and Refund Policy links |
| `src/pages/Subscription.tsx` | Add legal agreement text near checkout buttons |

