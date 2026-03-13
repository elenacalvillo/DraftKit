

# Landing Page Surgical Cleanup

Five targeted edits across 4 files. No new files needed.

## 1. HeroSection.tsx — Remove 01–04 step cards, fix microcopy position

**Remove lines 7–32** (the `steps` array) and **lines 132–166** (the entire "Product Loop Preview" grid with arrows). Also remove unused imports (`Send`, `Sparkles`, `FileText`, `Trophy`).

**Move microcopy**: The `<p>No credit card...</p>` on line 129 is inside the flex row with the buttons. Move it outside the button flex container so it sits below both CTAs. Change `mb-28` on the button container to `mb-4`, then add the microcopy `<p>` after the closing `</motion.div>` with `mb-20` spacing.

## 2. FeatureRoadmapSection.tsx — Remove duplicate subtitle

The subtitle on lines 47–49 ("Built for PMs and creators...") appears once. The user says it's duplicated — checking the render, it only exists once in this file. However, the `TestimonialsSection` or another section may echo similar text. I'll remove the subtitle line (47–49) entirely per the user's request, keeping just the "The honest answers" heading.

## 3. RealityOfGrowthSection.tsx — Chart styling cleanup

**Bar Chart (Card 1)**:
- Remove `CartesianGrid` component (line 92) — no grid lines
- Already horizontal (`layout="vertical"`) with left-aligned labels ✓

**Area Chart (Card 2)**:
- Remove `CartesianGrid` (line 129) — no grid lines
- Increase `strokeWidth` from `2` to `3` on the `<Area>` element
- Add `dot={false}` and `activeDot={{ r: 6, fill: ORANGE, stroke: "white", strokeWidth: 2 }}` to show interactive dot on hover

**Donut Chart (Card 3)**:
- No grid to remove — already clean ✓

## 4. BusyworkComparisonSection.tsx — Visual polish

**Old Way panel**:
- Change text class from `text-muted-foreground` to `text-muted-foreground/60` for lighter gray
- Change icon color from `text-destructive/60` to `text-destructive` for stronger red
- Keep `line-through decoration-destructive/40` on text

**DraftKit Way panel**:
- Add a soft orange glow: wrap or update the card's className to include `shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]` for a diffused orange glow behind the card

## 5. HowItWorksSection.tsx — Already correct

The descriptions are already the updated versions (Request, SMART Draft, Shared Workspace, Milestone). No changes needed.

## Files to modify

| File | Changes |
|---|---|
| `src/components/landing/HeroSection.tsx` | Remove `steps` array, step grid, unused imports; reposition microcopy below CTAs |
| `src/components/landing/FeatureRoadmapSection.tsx` | Remove subtitle paragraph |
| `src/components/landing/RealityOfGrowthSection.tsx` | Remove CartesianGrid from bar & area charts; thicker area line; add activeDot |
| `src/components/landing/BusyworkComparisonSection.tsx` | Lighter Old Way text; stronger red icons; orange glow on DraftKit Way card |

