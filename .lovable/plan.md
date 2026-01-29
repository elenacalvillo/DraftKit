
# Redesign "How It Works" Section

## Overview
Replace the current avatar-based step design with a cleaner, numbered circle design featuring chevron arrows between steps, matching the reference design you provided.

## Current vs. New Design

| Aspect | Current | New |
|--------|---------|-----|
| Step indicator | Profile avatars | Numbered circles (01, 02, 03) |
| Connector | Gradient horizontal line | Chevron arrow icons |
| Layout | 3 columns | 3 columns (keeping your 3 steps) |
| Step label | "Step 1" text badge | Number inside circle |
| Style | Heavy shadows, rings | Clean white circles with subtle border |

## Visual Changes

**Numbered Circles**
- Clean white background with subtle gray border
- Step number formatted as "01", "02", "03" 
- Primary brand color for the number text
- 16x16 (w-16 h-16) rounded-full circles

**Chevron Arrows**
- SVG chevron arrows between steps (hidden on mobile)
- Positioned to the right of each step (except the last)
- Subtle gray color to not distract from content

**Layout**
- Centered text alignment
- Title in medium weight, dark color
- Description in muted gray, relaxed line height

## Implementation Steps

1. **Remove avatar dependencies** - Remove Avatar imports and teamProfiles data
2. **Simplify step data** - Keep just title and description
3. **Update grid layout** - Maintain 3 columns with better spacing
4. **Replace step indicator** - Swap Avatar for numbered circle div
5. **Add chevron arrows** - Add inline SVG chevrons between steps
6. **Refine typography** - Match the clean, minimal style from reference

## Technical Details

```text
File to modify:
  src/components/landing/HowItWorksSection.tsx

Changes:
  - Remove: Avatar, AvatarImage, AvatarFallback imports
  - Remove: teamProfiles import
  - Simplify: steps array (remove profile property)
  - Replace: Avatar with numbered circle div
  - Add: Chevron arrow SVG between steps
  - Update: Styling to match cleaner aesthetic
```

## Step Content (Preserved)
The existing step content will be kept:
1. **Share Your Link** - Create your profile with a personal welcome message...
2. **Guests Pick a Date** - Collaborators see your availability...
3. **Prep Your Conversation** - Get curated talking points...
