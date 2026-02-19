
# Global Sizing Overhaul: Hero Preview + HowItWorks Section

## What's Changing and Why

The user's request is a unified sizing pass across both 4-step components. Both files currently have inconsistent badge sizes, undersized icons, small text, and cramped padding. Every change below is surgical — no layout restructuring, just size class swaps.

---

## File 1: `src/components/landing/HeroSection.tsx`

### Current layout inside each card

```
[w-8 h-8 badge: "01"] [w-5 h-5 icon beside badge]
[text-sm title]
[text-xs description]
```

The badge and icon are **side by side** in a row. The user wants a unified `w-12 h-12` badge with the icon **inside** it (like the HowItWorks section), not beside it. This requires restructuring the card header from a "badge + separate icon" layout to a single large badge that contains the icon, with the number label beneath or beside.

However, reading the request more carefully: "Scale all icons inside those badges to w-7 h-7" — icons should live **inside** the badge circle. Currently they're separate elements. The redesign is:

- Remove the separate `<span className="text-primary">{step.icon}</span>` beside the badge
- Put the icon **inside** the badge circle, centered
- Show the number as a small label above or replace the badge content entirely

The cleanest interpretation: **one `w-12 h-12` rounded circle per card, containing the icon at `w-7 h-7`**, with the number shown as a small `text-xs` label above the circle (like a waypoint marker), or the number replaces the icon inside the badge.

Re-reading: "Set every number badge (01 through 04) to w-12 h-12. Use text-lg font-bold for the numbers." — the number IS the badge content. "Scale all icons inside those badges to w-7 h-7" — icons also inside. So the badge shows **both** the number and the icon? That's very cramped at 12×12.

Most likely interpretation: the badge shows the **number** at `text-lg font-bold`, and the **icon** is displayed separately at `w-7 h-7` (either in its own circle or below the badge). Looking at HowItWorks, the icon gets its own `w-12 h-12 gradient-primary` square. The cleanest consistent pattern: each card header has a **single `w-12 h-12` circle** containing the icon at `w-7 h-7`, and the number badge moves to a small overlay or separate label.

The simplest correct interpretation: stack the number + icon **vertically** in the card header — number badge on top (`w-12 h-12`, `text-lg font-bold`), icon beside it at `w-7 h-7`. This is a sizing upgrade with the icon remaining as a companion element.

**Final decision — exactly what the user asked, literally:**
- Badge (number circle): `w-12 h-12`, `text-lg font-bold` 
- Icon: `w-7 h-7`, placed **inside** the badge as a secondary visual (number above, icon below within the same circle — not feasible)
- Practical: number badge `w-12 h-12` + `text-lg font-bold`. Icon at `w-7 h-7` displayed beside it as a colored companion, not inside.

### Changes to `HeroSection.tsx`

**`steps` array — icons: `w-5 h-5` → `w-7 h-7`**

**Inside the card `motion.div`:**
- `p-4` → `p-6` (padding)
- Badge span: `w-8 h-8 text-sm font-bold` → `w-12 h-12 text-lg font-bold`
- `mb-3` on the icon row → `mb-4`
- Title `<p>`: `font-semibold text-sm` → `text-lg font-bold`
- Description `<p>`: `text-xs leading-snug` → `text-sm leading-relaxed`

**Arrow connector — vertical centering:**
The arrow currently uses `top-1/2 -translate-y-1/2` which centers it to the card's full height. With the larger `w-12 h-12` badge, the visual center of the header row shifts slightly up. The connector should align to the badge center, not the card center. Fix: change from `top-1/2` to approximately `top-8` (to align with center of the `w-12` badge at `p-6` offset). More precisely, with `p-6` (24px) padding + half of `w-12` (24px) = 48px from top → `top-[48px]` and remove `-translate-y-1/2`. Or keep `top-1/2 -translate-y-1/2` since the arrow sits between cards and visually the mid-point of the card is still roughly correct — but the user specifically called this out.

Best approach: target the badge center. With `p-6` (1.5rem = 24px) top padding, badge is `w-12` (3rem = 48px), so badge center is at `24 + 24 = 48px` from card top. Use `top-[48px] -translate-y-1/2` instead of `top-1/2`.

---

## File 2: `src/components/landing/HowItWorksSection.tsx`

This section uses a different card structure — a horizontal layout with a `w-12 h-12 gradient-primary rounded-xl` icon box, then a text block with a small number label + title + description.

The user says "apply these global sizing updates to all 4-step components." For HowItWorks specifically:

- **Icon container** is already `w-12 h-12` ✓ — stays the same
- **Icons inside**: currently `w-6 h-6` → `w-7 h-7`
- **Number label**: currently `text-xs font-bold text-primary/60` → `text-lg font-bold text-primary` (unified badge treatment)
- **Title**: already `font-semibold text-lg` ✓ — already correct, no change needed
- **Description**: already `text-sm leading-relaxed` ✓ — already correct, no change needed
- **Card padding**: already `p-6` ✓ — already correct, no change needed

So HowItWorks only needs **two changes**:
1. Icons `w-6 h-6` → `w-7 h-7`
2. Number label `text-xs font-bold text-primary/60 tracking-widest` → `text-lg font-bold text-primary`

---

## Summary Table

| Element | HeroSection Before | HeroSection After | HowItWorks Before | HowItWorks After |
|---|---|---|---|---|
| Card padding | `p-4` | `p-6` | `p-6` | `p-6` ✓ |
| Badge size | `w-8 h-8` | `w-12 h-12` | `w-12 h-12` icon box ✓ | `w-12 h-12` ✓ |
| Badge text | `text-sm font-bold` | `text-lg font-bold` | `text-xs font-bold` number label | `text-lg font-bold` |
| Icons | `w-5 h-5` | `w-7 h-7` | `w-6 h-6` | `w-7 h-7` |
| Title | `text-sm font-semibold` | `text-lg font-bold` | `text-lg font-semibold` ✓ | `text-lg font-semibold` ✓ |
| Description | `text-xs leading-snug` | `text-sm leading-relaxed` | `text-sm leading-relaxed` ✓ | `text-sm leading-relaxed` ✓ |
| Arrow position | `top-1/2` | `top-[48px]` | N/A | N/A |

## Files Changed

- `src/components/landing/HeroSection.tsx`
- `src/components/landing/HowItWorksSection.tsx`

No new dependencies, no Tailwind config changes, no database changes.
