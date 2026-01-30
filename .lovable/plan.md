

# Fix DraftKit Coral to Match Landing Page Gradient

## The Problem

I completely misunderstood. The **DraftKit Coral** preset should NOT be the intense coral gradient. It should match the **landing page hero background** - which is a **soft, warm cream** gradient, not the saturated coral/terracotta.

Looking at the CSS:
- `--gradient-hero` (landing page background): `hsl(39 33% 97%)` → `hsl(25 30% 96%)` → `hsl(8 40% 96%)`
- `--gradient-primary` (intense coral for buttons): `hsl(8 65% 65%)` → `hsl(24 58% 60%)`

I wrongly used `--gradient-primary` for the profile background when it should use `--gradient-hero`.

---

## Solution

Update **DraftKit Coral** to use the soft cream tones from `--gradient-hero`:
- Primary: `39 33% 97%` (warm cream)
- Secondary: `8 40% 96%` (hint of coral warmth)

This matches exactly what you see on the landing page - a soft, sophisticated background that lets content shine.

---

## Updated Color Values

| Preset | HSL Values | Description |
|--------|------------|-------------|
| **DraftKit Coral** | `39 33% 97%` → `8 40% 96%` | Soft cream with coral warmth (matches landing) |
| **Ocean Breeze** | `200 20% 95%` → `190 15% 96%` | Near-white with sky hint |
| **Sunset Glow** | `20 22% 95%` → `35 18% 96%` | Near-white with peach hint |
| **Forest Mist** | `145 18% 94%` → `155 14% 95%` | Near-white with mint hint |
| **Lavender Dream** | `255 18% 95%` → `270 14% 96%` | Near-white with lavender hint |
| **Silver Slate** | `220 8% 95%` → `220 5% 97%` | Near-white with silver hint |

---

## Implementation

### File: `src/lib/theme-presets.ts`

```typescript
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: 'default',
    name: 'DraftKit Coral',
    description: 'Our signature warm cream gradient',
    colors: {
      // Matches --gradient-hero from landing page
      primary: '39 33% 97%',     // Warm cream (same as background)
      secondary: '8 40% 96%',    // Subtle coral warmth
      accent: '8 65% 65%',       // Coral for interactive elements
      glow: '8 50% 90%',         // Soft coral glow
    },
    angle: 135,
    isPro: false,
  },
  // ... other presets stay the same (ultra-bright near-white)
};
```

---

## Visual Result

The DraftKit Coral default will now:
- Match the soft cream landing page background exactly
- Feel cohesive with the rest of the DraftKit brand
- Allow the coral hyperlinks and buttons to pop as intended
- All Pro presets remain ultra-soft near-white pastels

---

## File to Modify

| File | Change |
|------|--------|
| `src/lib/theme-presets.ts` | Update default preset to match `--gradient-hero` values |

