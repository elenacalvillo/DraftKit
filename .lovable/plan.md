
# Add DraftKitLogo to HeroSection

## What and Why

The HeroSection currently opens with a small badge chip (`Zap` icon + text) and then jumps straight to the headline. There is no visual brand anchor — nothing tells a first-time visitor "this is a product, not a blog post." Adding the Venn-ring mark above the headline gives the hero a center-of-gravity, ties the landing page visually to every other page where the logo already appears (Navbar, auth pages, sidebar), and reinforces the "two creators, one workspace" metaphor that the entire messaging is built around.

## Exact Placement

The logo drops in between the animated badge and the `<h1>`, centered. The badge stays as the first element (it explains context), the logo comes second (visual identity), the headline third (the promise), and the CTA fourth — standard hero anatomy for a product page.

```text
[badge: "Built for creators who ship..."]
[DraftKitLogo at 72px, centered]
[h1: "Stop chasing drafts. / Start shipping together."]
[subhead]
[CTAs]
[Product Loop]
```

## Size Choice: 72px

| Size | Context |
|------|---------|
| 32px | Navbar / Footer / mobile header |
| 40px | Sidebar |
| 56px | Auth page heroes |
| **72px** | **Landing hero — largest treatment on the site** |

72px (`size={72}`) is the right step up from the auth-page 56px. It reads clearly on desktop and doesn't feel oversized on mobile since it's a compact square mark.

## Animation

The logo gets the same Framer Motion `initial / animate` pattern the badge and headline already use — `opacity: 0 → 1, y: 20 → 0` — at delay `0.075` (after the badge at `0`, before the headline at `0.1`). This threads it cleanly into the existing staggered reveal without breaking the flow.

## Technical Details

**File changed:** `src/components/landing/HeroSection.tsx` only.

**Two edits:**
1. Add `import { DraftKitLogo } from "@/components/icons/DraftKitLogo";` at the top.
2. Insert a `<motion.div>` wrapping `<DraftKitLogo size={72} />` between the badge block and the `<motion.h1>` block.

No new files, no Tailwind changes, no dependency changes. The component is already in the codebase and works correctly at any size.

## What the inserted block looks like

```tsx
{/* Logo mark */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.075 }}
  className="flex justify-center mb-6"
>
  <DraftKitLogo size={72} />
</motion.div>
```

`mb-6` keeps tight spacing to the headline beneath. The existing `mb-8` on the badge above provides natural breathing room between the two.
