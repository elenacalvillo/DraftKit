
# Fix Subscription Page: Toggle Styling + Manage Button

## Problem 1: Toggle looks wrong
The active toggle uses `bg-primary` which is the coral/salmon brand color -- too bold for a small UI control. The toggle should use a subtle, neutral active state that feels clean.

**Fix:** Change the active toggle style to use `bg-background shadow-sm border` instead of `bg-primary text-primary-foreground`. This gives a clean "card popping out of the muted background" look, standard for billing toggles.

## Problem 2: Manage button hidden for early adopters
The Manage button only shows when `tier === 'pro'` (Stripe subscription), but early adopters get Pro status via `user_roles`, where `tier` remains `'free'`. These users still need access to billing management if they later subscribe.

**Fix:** Show the Manage button whenever `isPro && !isInTrial` -- regardless of how they got Pro status. The `handleManage` function already handles the "no Stripe customer" case gracefully with a toast, so there's no risk.

## File Changes

**`src/pages/Subscription.tsx`**

1. Toggle active state: change from `bg-primary text-primary-foreground shadow-md` to `bg-background text-foreground shadow-sm` for both Monthly and Yearly buttons
2. Manage button condition: change `{!isInTrial && tier === 'pro' && (` to `{!isInTrial && isPro && (`
