

# Brand Customization Feature Implementation

## Overview

This feature adds custom profile themes as a Pro-tier benefit, allowing creators to personalize the background gradient on their public booking page (`/@username`). This creates a stronger sense of brand identity and increases platform stickiness through customization investment.

---

## Feature Breakdown

| Feature | Free Tier | Pro Tier |
|---------|-----------|----------|
| Profile Theme | DraftKit Signature (Coral/Cream) | Custom Gradients & Brand Colors |
| Presets | DraftKit Default only | 6+ curated professional presets |
| Custom Colors | Not available | Full hex code picker |

---

## Technical Implementation

### Phase 1: Database Schema Updates

**Add theme column to `creators` table:**

```sql
ALTER TABLE creators ADD COLUMN profile_theme JSONB DEFAULT '{"preset": "default"}'::jsonb;
```

The JSONB structure supports:
- Preset themes: `{"preset": "coral"}`
- Custom colors: `{"type": "linear", "colors": ["#FF6B6B", "#4ECDC4"], "angle": 135}`
- Future mesh gradients: `{"type": "mesh", "colors": [...], "positions": [...]}`

**Update `public_creator_profiles` view** to expose the theme:

```sql
CREATE OR REPLACE VIEW public_creator_profiles AS
SELECT 
  id, username, name, bio, substack_url, newsletter_url,
  welcome_message, profile_image_url, collab_style, 
  collab_guidelines, date_meaning, collab_mode, created_at,
  profile_theme  -- NEW: Expose theme to public booking page
FROM creators;
```

---

### Phase 2: Theme Presets

**New file: `src/lib/theme-presets.ts`**

Define 6 curated gradient presets with professional aesthetics:

| Preset ID | Name | Colors | Style |
|-----------|------|--------|-------|
| `default` | DraftKit Coral | Coral → Terracotta | Brand default |
| `ocean` | Ocean Depths | Deep Blue → Teal | Cool professional |
| `sunset` | Sunset Warmth | Orange → Pink | Warm creative |
| `forest` | Forest Calm | Emerald → Sage | Natural balanced |
| `midnight` | Midnight Pro | Purple → Indigo | Dark sophisticated |
| `monochrome` | Clean Slate | Gray → Slate | Minimal neutral |

Each preset includes:
- `backgroundGradient`: CSS for the page background
- `accentGradient`: CSS for interactive elements
- `glowColor`: HSL for the profile image ring

---

### Phase 3: Settings UI - Style Tab

**New component: `src/components/settings/ProfileStyleSection.tsx`**

A new glass-card section in Settings with:

1. **Preset Grid** (2x3 for 6 presets)
   - Visual swatch preview showing the gradient
   - Radio-style selection with checkmark
   - Current theme highlighted

2. **Custom Color Picker** (Pro only)
   - Two color inputs (start/end)
   - Angle slider (45°/90°/135°/180°)
   - Live preview swatch

3. **Pro Gate**
   - Free users see presets locked with a Pro badge overlay
   - Clicking locked preset shows `UpgradePrompt` with feature copy
   - Only "DraftKit Default" is available on free tier

**Settings page modification:**

Add the Style section between "Profile" and "Collaboration Playbook" sections.

---

### Phase 4: Public Booking Page Theme Application

**Modify: `src/pages/PublicBooking.tsx`**

Apply the creator's theme to:

1. **Page Background** - Replace fixed `gradient-bg` class with dynamic CSS variable
2. **Floating Orbs** - Use theme accent colors for animated background blobs
3. **Profile Ring** - Apply theme's glow color to the profile image ring

```typescript
// Generate CSS custom properties from theme
const themeStyles = useMemo(() => {
  const theme = creator.profile_theme || { preset: 'default' };
  return getThemeStyles(theme);
}, [creator.profile_theme]);

// Apply as inline style to root container
<div style={themeStyles}>
```

---

### Phase 5: Live Preview in Settings

**Add preview panel to Style section:**

A miniature representation of the public booking page that updates in real-time as the user selects presets or adjusts custom colors. This creates the "investment" moment where creators spend time perfecting their look.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add `profile_theme` column |
| `src/lib/theme-presets.ts` | Create | Preset definitions and theme utilities |
| `src/components/settings/ProfileStyleSection.tsx` | Create | Style customization UI |
| `src/pages/Settings.tsx` | Modify | Add Style section |
| `src/pages/PublicBooking.tsx` | Modify | Apply theme to page |
| `src/hooks/useAuth.tsx` | Modify | Include `profile_theme` in Creator type |

---

## Implementation Order

1. **Database migration** - Add `profile_theme` column and update view
2. **Create theme presets** - Define the 6 professional gradients
3. **Build Style section component** - Preset grid + custom picker
4. **Integrate into Settings** - Add new section with Pro gating
5. **Apply theme on PublicBooking** - Dynamic background rendering
6. **Add live preview** - Real-time feedback in Settings

---

## Pro Feature Gating Logic

```typescript
// In ProfileStyleSection.tsx
const { isPro } = usePro();

// Free users: Only "default" preset clickable
// Pro users: All presets + custom picker available

const handlePresetClick = (presetId: string) => {
  if (!isPro && presetId !== 'default') {
    // Show upgrade prompt
    setShowUpgrade(true);
    return;
  }
  setSelectedPreset(presetId);
};
```

---

## Analytics Events

Track user engagement with the feature:

- `profile_theme_changed` - When a user selects a new preset or custom theme
- `profile_theme_upgrade_prompt_shown` - When free user clicks locked preset
- `profile_theme_upgrade_clicked` - When user clicks "Go Pro" from theme section

---

## Why This Fits the DraftKit Brand

1. **Zero API Cost** - Just a hex code in the database, no LLM calls
2. **Visual Social Proof** - Custom themes on shared links signal "Pro" status
3. **Retention Hook** - Time invested in customization = lower churn
4. **The "Lovable" Factor** - Doesn't block shipping posts, just makes the experience premium

