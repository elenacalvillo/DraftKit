
# Visual Authority: Five Targeted Refinements

## What's Being Fixed

The screenshot confirms five specific issues — all are low-risk, single-file edits with no new dependencies.

---

## Change 1 — Brand Text Contrast (Navbar + Hero headline)

**Problem:** "DraftKit" wordmark in the Navbar renders as a coral gradient. The hero second line "Start shipping together." also uses `gradient-text` (coral). Both fight for attention with the logo mark itself, which already carries the brand's coral.

**Fix:** Replace `gradient-text` with a literal dark color class that maps to `#2a2318` — the exact dark stroke color of the left Venn circle. This anchors the wordmark to the logo visually.

- **Navbar (`Navbar.tsx` line 18):** `gradient-text` → `text-[#2a2318]`
- **Hero headline (`HeroSection.tsx` line 97):** `gradient-text` on the `<span>` → `text-[#2a2318]`

---

## Change 2 — Arrow Connector Stroke Weight (HeroSection)

**Problem:** The `ArrowRight` icons between the 4 step cards are `w-4 h-4 text-muted-foreground/40` — too small and washed out.

**Fix:** Increase to `w-5 h-5`, full `text-foreground/50` opacity, and add `strokeWidth` override via a wrapper with `[&>*]:stroke-[3]` or use the `stroke-width` prop directly. Lucide icons accept `strokeWidth` as a prop.

```tsx
<ArrowRight className="w-5 h-5 text-foreground/50" strokeWidth={3} />
```

---

## Change 3 — Number Badge Size (HeroSection)

**Problem:** The coral number badges (`01`, `02`, etc.) use `w-6 h-6 text-xs font-bold` — small enough that the eye doesn't land on them as waypoints.

**Fix:**
- Container: `w-8 h-8` (from `w-6 h-6`)
- Text: `text-sm font-bold` (from `text-xs font-bold`)

This makes the number the dominant anchor in each card header, as intended.

---

## Change 4 — Icon Density in Cards (HeroSection)

**Problem:** The Lucide icons (`Send`, `Sparkles`, `FileText`, `Trophy`) are `w-4 h-4` — they float lost next to the number badge.

**Fix:** Scale up to `w-5 h-5` so they visually balance against the now-larger `w-8 h-8` badge. The icons live inside the `steps` array as JSX so they need to be updated at the array definition level.

---

## Change 5 — Vertical Rhythm (HeroSection)

**Problem:** The CTA buttons and the 4-step preview are separated by `mb-20` on the CTA wrapper. The user wants more breathing room (`gap-y-16` between them).

**Fix:** Change `mb-20` on the CTA `motion.div` to `mb-28`. This adds ~32px additional vertical space — equivalent to `gap-y-16` — without touching the grid itself.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/layout/Navbar.tsx` | Brand text: `gradient-text` → `text-[#2a2318]` |
| `src/components/landing/HeroSection.tsx` | Headline span color, arrow weight/size, badge size, icon size, CTA bottom margin |

---

## Technical Notes

- `text-[#2a2318]` is a Tailwind arbitrary value — no config change needed, it works out of the box with Tailwind v3+
- `strokeWidth={3}` is a native prop on all Lucide React icons — no wrapper tricks needed
- All icon changes are at the `steps` array definition (top of the file), so all 4 icons update together in one block
- No layout regressions expected — changes are additive size increases within existing containers
