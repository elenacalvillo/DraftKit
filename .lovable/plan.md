
# Ultra-Bright Theme Presets + Authentic DraftKit Coral

## Problem Analysis

Looking at the screenshots, there are two distinct issues:

1. **Pastel presets are still too dark** (80-88% lightness) - The Ocean Breeze and Forest Mist examples show backgrounds that still feel heavy and saturated
2. **DraftKit Coral isn't using the real brand colors** - You want the default preset to show the authentic DraftKit coral gradient as seen in the HeroSection, not a softened version

## Solution

### Part 1: Default Preset = Real DraftKit Colors

Use the actual brand gradient from `index.css`:
```css
--gradient-primary: linear-gradient(135deg, hsl(8 65% 65%) 0%, hsl(12 60% 72%) 50%, hsl(24 58% 60%) 100%)
```

So `default` preset will use:
- Primary: `8 65% 65%` (the authentic DraftKit coral)
- Secondary: `24 58% 60%` (terracotta end of gradient)

This gives you the real DraftKit look on your profile by default.

---

### Part 2: Pro Presets = Ultra-Bright 95% Lightness

All other presets get pushed to 93-96% lightness with minimal saturation (12-20%), creating barely-there watercolor washes:

| Preset | New HSL Values | Visual Effect |
|--------|----------------|---------------|
| **Ocean Breeze** | `200 20% 95%` → `190 15% 96%` | Near-white with hint of sky |
| **Sunset Glow** | `20 22% 95%` → `35 18% 96%` | Near-white with hint of peach |
| **Forest Mist** | `145 18% 94%` → `155 14% 95%` | Near-white with hint of mint |
| **Lavender Dream** | `255 18% 95%` → `270 14% 96%` | Near-white with hint of lavender |
| **Silver Slate** | `220 8% 95%` → `220 5% 97%` | Near-white with hint of silver |

---

### Part 3: Hyperlink Theming (Consideration)

Currently, the coral/salmon hyperlinks use `text-primary` (coral). On the non-default themes, this creates visual contrast. Two options:

**Option A (Keep as-is)**: The coral links act as a brand anchor, reminding users this is DraftKit even with a custom theme. This creates consistency across all profiles.

**Option B (Theme-adaptive)**: Links could inherit from the theme's accent color. This would require:
- Adding a CSS variable `--theme-accent` 
- Updating link classes to use `text-[hsl(var(--theme-accent))]` or a darker variant

**Recommendation**: Keep the coral links as brand anchors for now. The primary/coral color is DraftKit's identity, and having it consistent across all themes reinforces brand recognition when users share their links.

---

## Technical Implementation

### File: `src/lib/theme-presets.ts`

```typescript
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: 'default',
    name: 'DraftKit Coral',
    description: 'Our signature warm coral gradient',
    colors: {
      // REAL DraftKit brand colors from --gradient-primary
      primary: '8 65% 65%',      // Authentic coral
      secondary: '24 58% 60%',   // Terracotta end
      accent: '8 65% 65%',
      glow: '12 60% 72%',        // Mid-gradient for glow
    },
    angle: 135,
    isPro: false,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Whisper of sky blue',
    colors: {
      primary: '200 20% 95%',    // Near-white sky
      secondary: '190 15% 96%',  // Softer aqua
      accent: '200 20% 95%',
      glow: '200 20% 93%',
    },
    angle: 135,
    isPro: true,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Whisper of peach warmth',
    colors: {
      primary: '20 22% 95%',     // Near-white peach
      secondary: '35 18% 96%',   // Softer cream
      accent: '20 22% 95%',
      glow: '20 22% 93%',
    },
    angle: 135,
    isPro: true,
  },
  forest: {
    id: 'forest',
    name: 'Forest Mist',
    description: 'Whisper of mint',
    colors: {
      primary: '145 18% 94%',    // Near-white mint
      secondary: '155 14% 95%',  // Softer sage
      accent: '145 18% 94%',
      glow: '145 18% 92%',
    },
    angle: 135,
    isPro: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Lavender Dream',
    description: 'Whisper of lavender',
    colors: {
      primary: '255 18% 95%',    // Near-white lavender
      secondary: '270 14% 96%',  // Softer lilac
      accent: '255 18% 95%',
      glow: '255 18% 93%',
    },
    angle: 135,
    isPro: true,
  },
  monochrome: {
    id: 'monochrome',
    name: 'Silver Slate',
    description: 'Whisper of silver',
    colors: {
      primary: '220 8% 95%',     // Near-white silver
      secondary: '220 5% 97%',   // Almost white
      accent: '220 8% 95%',
      glow: '220 8% 93%',
    },
    angle: 135,
    isPro: true,
  },
};
```

---

## Visual Result

| Preset | Before (Screenshot) | After |
|--------|---------------------|-------|
| **DraftKit Coral** | Soft pastel blush | Rich, authentic coral gradient (brand identity) |
| **Ocean Breeze** | Too saturated green-blue | Barely-there sky wash, near-white |
| **Sunset Glow** | Still visible peach | Whisper of warmth, near-white |
| **Forest Mist** | Heavy mint | Hint of freshness, near-white |
| **Lavender Dream** | Strong purple | Subtle lavender tint, near-white |
| **Silver Slate** | Visible gray | Nearly invisible silver, almost white |

The Pro presets become sophisticated, barely-there backgrounds that let the creator's content and the glass cards truly shine. Meanwhile, the default DraftKit Coral shows the brand's signature look.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/theme-presets.ts` | Update default to real brand colors; push Pro presets to 95%+ lightness |
