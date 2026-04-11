

# Membership Page Overhaul: From Utility Bill to Growth Engine

## What Changes

### 1. Kill "Host Spots" everywhere
- "0 of 3 host spots used" → **"You have 3 collaboration slots open"**
- "3 left" badge → **"3 open"**
- "bonus spot/spots" → **"bonus slot/slots"**
- "unlock unlimited host spots" → **"Go Unlimited"**
- Remove the robotic progress bar; replace with a warmer, opportunity-framed message

### 2. Add "Invite & Earn" card (above the paywall)
Right under the collaboration slots banner, a new card:
- Headline: **"Bring a writer, get a credit"**
- Body: "Invite a co-writer to DraftKit. When they join, you both get +1 collaboration credit."
- Button: **"Invite a Collaborator"** (opens the Discoverable Invites modal or navigates to the invite flow)
- This becomes the visual hero before the pricing card, making the free growth path feel like the smart move

### 3. Tone fixes
- "CREDITS" header → **"Writer's Credits"**
- "credits remaining" → **"credits in your pocket"**
- "Need a quick boost?" stays (it's warm enough)
- "Unlock Unlimited Collabs" CTA → **"Go Unlimited"**
- Referral bonus text: "You've earned X bonus slots by inviting friends." (slots, not spots)
- Low capacity warning: "Invite a friend or go unlimited to keep collaborating."

### 4. Visual hierarchy shift
- Invite & Earn card gets a subtle gradient border (primary/20) to draw the eye before the pricing card
- Credit top-up section stays below pricing but with the updated "Writer's Credits" header

## File

| File | Change |
|------|--------|
| `src/pages/Subscription.tsx` | Rewrite free-user view: rename all "host spots" to "collaboration slots", add Invite & Earn card, update CTA copy, update credit section header |

