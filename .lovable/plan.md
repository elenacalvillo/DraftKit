

# Growth Loop Polish — 3 Fixes + Content Updates

All changes from the approved plan plus the three polish points.

## Files & Changes

### 1. `src/components/landing/HowItWorksSection.tsx`
- **Step 01 text**: Update description to include referral note, using consistent term "collaboration credit":
  > "Send a professional front-door invite that replaces messy DMs. When you invite a new partner to the platform, you both earn a collaboration credit."
- **Equal card heights**: Add `h-full` to the card's `className` on line 60 so all four cards stretch to the same height in the 2-col grid.

### 2. `src/components/landing/DirectDiscoveryCard.tsx`
- **Growth Tip text** (line 80-82): Change to:
  > "Pro tip: Invite your favorite writers to DraftKit. When they join, you both earn a collaboration credit."

### 3. `src/components/landing/FeatureRoadmapSection.tsx`
- **Add 2 new FAQ entries** (total 9, fills 3×3 grid cleanly):
  - Entry 8: `Q: "Can I keep using DraftKit for free?"` / `A: "Yes. While our pro tools offer more, you can always earn collaboration credits by inviting other writers to join the community. We want to reward the people who help the network grow."`
  - Entry 9: `Q: "Can I use this for my guest post on Substack?"` / `A: "Absolutely. DraftKit is built for any type of collaboration—guest posts, interviews, co-written pieces. If two writers are working together, we make it easier."`

### 4. `src/components/landing/BottomCTASection.tsx`
- Split the paragraph into two lines with the referral mechanic highlighted:
  - Line 1 (muted): "Your first 3 collaborations are free."
  - Line 2 (primary, font-medium): "Unlock 1 extra collaboration credit for every new writer you invite who registers."
- Standardize to "collaboration credit" everywhere.

### Terminology alignment
All copy across all four files will use **"collaboration credit"** consistently — never "free collaboration" or "free collab."

| File | Changes |
|---|---|
| `HowItWorksSection.tsx` | Step 01 referral note + `h-full` on cards |
| `DirectDiscoveryCard.tsx` | Updated Growth Tip text |
| `FeatureRoadmapSection.tsx` | 2 new FAQ entries (9 total, fills 3×3 grid) |
| `BottomCTASection.tsx` | Two-line structure with highlighted referral bullet |

