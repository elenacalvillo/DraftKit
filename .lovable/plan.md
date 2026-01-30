
# Fix Theme Preset Color Palette

## Problem

The current theme presets use overly saturated colors that clash with DraftKit's light cream interface. The screenshot shows a harsh coral/terracotta gradient that overwhelms the page and creates poor contrast with UI elements like the calendar and collaboration badges.

---

## Solution

Redesign the color palette to:
1. Match the **DraftKit brand** for the default preset (use actual `--primary` HSL value)
2. Convert all Pro presets to **soft pastel tones** with lower saturation and higher lightness
3. Maintain visual distinction between presets while ensuring harmony with the interface

---

## Color Changes

### Before vs After

| Preset | Before (Saturated) | After (Pastel) |
|--------|-------------------|----------------|
| **Default** | `12 76% 61%` (harsh coral) | `8 65% 65%` (DraftKit primary) |
| **Ocean** | `210 80% 50%` (intense blue) | `210 40% 70%` (soft sky blue) |
| **Sunset** | `35 90% 55%` (harsh orange) | `25 50% 72%` (soft peach) |
| **Forest** | `150 60% 40%` (dark emerald) | `150 35% 65%` (soft sage) |
| **Midnight** | `270 60% 50%` (vivid purple) | `260 35% 68%` (soft lavender) |
| **Monochrome** | `220 10% 50%` (flat gray) | `220 15% 75%` (soft silver) |

### Design Principles Applied:
- **Saturation**: Reduced from 60-90% down to 30-50%
- **Lightness**: Increased to 65-75% for pastel effect
- **Gradients**: Subtle transitions between similar tones (not contrasting hues)

---

## Implementation

### File: `src/lib/theme-presets.ts`

Update the `THEME_PRESETS` object with pastel-friendly HSL values:

```typescript
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: 'default',
    name: 'DraftKit Coral',
    description: 'Our signature warm coral gradient',
    colors: {
      primary: '8 65% 65%',      // Matches --primary exactly
      secondary: '12 55% 70%',   // Softer coral
      accent: '8 65% 65%',
      glow: '8 65% 65%',
    },
    angle: 135,
    isPro: false,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Calm, professional soft blue',
    colors: {
      primary: '210 40% 70%',    // Soft sky blue
      secondary: '195 35% 75%', // Soft aqua
      accent: '210 40% 70%',
      glow: '195 40% 75%',
    },
    angle: 135,
    isPro: true,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm, inviting peach tones',
    colors: {
      primary: '25 50% 72%',    // Soft peach
      secondary: '340 40% 75%', // Soft rose
      accent: '25 50% 72%',
      glow: '25 50% 72%',
    },
    angle: 135,
    isPro: true,
  },
  forest: {
    id: 'forest',
    name: 'Forest Mist',
    description: 'Natural, balanced sage',
    colors: {
      primary: '150 35% 65%',   // Soft sage
      secondary: '140 30% 72%', // Soft mint
      accent: '150 35% 65%',
      glow: '150 35% 70%',
    },
    angle: 135,
    isPro: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Lavender Dream',
    description: 'Soft, elegant purple',
    colors: {
      primary: '260 35% 68%',   // Soft lavender
      secondary: '280 30% 75%', // Soft lilac
      accent: '260 35% 68%',
      glow: '260 35% 72%',
    },
    angle: 135,
    isPro: true,
  },
  monochrome: {
    id: 'monochrome',
    name: 'Silver Slate',
    description: 'Minimal, elegant neutral',
    colors: {
      primary: '220 15% 75%',   // Soft silver
      secondary: '220 12% 80%', // Light gray
      accent: '220 15% 75%',
      glow: '220 15% 78%',
    },
    angle: 135,
    isPro: true,
  },
};
```

---

## Visual Result

The new pastel palette will:
- **Blend smoothly** with the cream background (`39 33% 97%`)
- **Reduce visual strain** by avoiding high saturation colors
- **Allow UI elements** (cards, buttons, badges) to remain readable
- **Feel premium** through subtle, sophisticated color choices

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/theme-presets.ts` | Update all 6 preset color values to pastel tones |

---

## Why This Works

1. **Brand Consistency**: Default now uses the exact DraftKit `--primary` color
2. **Interface Harmony**: Pastel tones don't compete with UI elements
3. **Professional Aesthetic**: Soft gradients feel more sophisticated than saturated ones
4. **Creator-Friendly**: The subtle palette lets profile photos and content stand out
