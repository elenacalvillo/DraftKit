

# Brighten Theme Presets - Soft Watercolor Pastels

## Problem

The current pastel tones are still too saturated and dark. The screenshots show:
- Purple preset: Overwhelming, harsh violet that dominates the page
- Blue preset: Better but still feels heavy and muted

The gradients need to feel like **soft watercolor washes** - bright, airy, and barely-there.

---

## Solution

Increase **lightness to 82-90%** and reduce **saturation to 20-35%** for all presets. The goal is bright, luminous backgrounds that feel like natural light washing over the page.

---

## Color Changes

### Current vs Proposed

| Preset | Current HSL | Proposed HSL | Visual Effect |
|--------|-------------|--------------|---------------|
| **Default** | `8 65% 65%` | `8 55% 80%` | Soft blush coral |
| **Ocean** | `210 40% 70%` | `200 35% 85%` | Airy sky blue |
| **Sunset** | `25 50% 72%` | `20 40% 85%` | Light peach glow |
| **Forest** | `150 35% 65%` | `145 30% 82%` | Mint whisper |
| **Midnight** | `260 35% 68%` | `255 28% 85%` | Pale lavender mist |
| **Monochrome** | `220 15% 75%` | `220 12% 88%` | Soft cloud gray |

### Design Principles:
- **Lightness**: 82-90% (bright, luminous)
- **Saturation**: 20-35% (whisper-soft color)
- **Gradient difference**: Only 3-5% lightness shift between start/end colors for subtle effect

---

## Updated Presets

```typescript
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: 'default',
    name: 'DraftKit Coral',
    description: 'Our signature warm coral gradient',
    colors: {
      primary: '8 55% 80%',      // Soft blush
      secondary: '12 45% 84%',   // Lighter blush
      accent: '8 55% 80%',
      glow: '8 55% 78%',
    },
    angle: 135,
    isPro: false,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Calm, airy sky blue',
    colors: {
      primary: '200 35% 85%',    // Pale sky
      secondary: '190 30% 88%',  // Softer aqua
      accent: '200 35% 85%',
      glow: '200 35% 83%',
    },
    angle: 135,
    isPro: true,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm peach whisper',
    colors: {
      primary: '20 40% 85%',     // Pale peach
      secondary: '35 35% 88%',   // Soft cream
      accent: '20 40% 85%',
      glow: '20 40% 83%',
    },
    angle: 135,
    isPro: true,
  },
  forest: {
    id: 'forest',
    name: 'Forest Mist',
    description: 'Light mint whisper',
    colors: {
      primary: '145 30% 82%',    // Pale mint
      secondary: '155 25% 86%',  // Softer sage
      accent: '145 30% 82%',
      glow: '145 30% 80%',
    },
    angle: 135,
    isPro: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Lavender Dream',
    description: 'Soft lavender mist',
    colors: {
      primary: '255 28% 85%',    // Pale lavender
      secondary: '270 22% 88%',  // Softer lilac
      accent: '255 28% 85%',
      glow: '255 28% 83%',
    },
    angle: 135,
    isPro: true,
  },
  monochrome: {
    id: 'monochrome',
    name: 'Silver Slate',
    description: 'Soft cloud gray',
    colors: {
      primary: '220 12% 88%',    // Pale silver
      secondary: '220 8% 91%',   // Near white
      accent: '220 12% 88%',
      glow: '220 12% 86%',
    },
    angle: 135,
    isPro: true,
  },
};
```

---

## Visual Result

The new ultra-soft palette will:
- Feel **bright and luminous** like natural daylight
- Create **barely-there gradients** that don't compete with content
- Let **profile photos and UI elements** pop against the soft background
- Look **premium and sophisticated** through restraint

---

## File to Modify

| File | Change |
|------|--------|
| `src/lib/theme-presets.ts` | Update all preset HSL values to brighter, softer tones |

