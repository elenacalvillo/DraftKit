

## Plan: Performance + landing page polish (mobile-first fixes)

I'll focus on what's **actually fixable in our code** and skip the noise (chart breakage isn't real per your check; "500+ writers" social proof requires real numbers we don't have yet).

### Triage of the report

| Suggestion | Action | Why |
|---|---|---|
| Lazy-load images below fold | ✅ Implement | Real win |
| WebP compression | ⚠️ Skip for now | Landing uses ~zero raster images; mostly SVG/Recharts |
| Page hiccups between routes | ✅ Fix (root cause) | This is the **real** issue you're feeling |
| Pricing teaser on landing | ✅ Add small section | Quick trust win |
| SEO meta title/description | ✅ Update `index.html` | 1-line fix |
| Mobile CTA card / navbar overflow | ✅ Fix per screenshots | Confirmed visible bug |
| Demo video | ❌ Skip | Already have `/demo` link in hero |
| Quantitative social proof ("500+") | ❌ Skip | Inventing numbers violates the "Sam Filter" honesty rule |
| Integration logos (Substack/Ghost/Beehiiv) | ❌ Skip | We only integrate with Substack — claiming Ghost/Beehiiv would be dishonest |

### The real performance issue: route-change "hiccups"

You're describing the classic pattern: navigate to `/requests` → blank/jumpy state → data lands → layout shifts. Two compounding causes:

1. **No scroll reset on route change** → land at random scroll position, then content loads above/below → perceived "jump."
2. **Loading states that don't reserve space** → list renders empty (`h-0`), then suddenly fills with 600px of cards → big CLS jump.
3. **Every page refetches from scratch** on each visit, even if you were just there 2 seconds ago.

### Fixes — grouped

**A. Route transitions (the hiccup fix)**
- Add `<ScrollToTop />` component in `App.tsx` (mounted inside `BrowserRouter`, runs on `pathname` change).
- Audit the highest-traffic dashboard pages (`Dashboard.tsx`, `Requests.tsx`, `MyRequests.tsx`, `Workspace.tsx`) and ensure their loading states render **skeletons sized like the final content** instead of `null` or a tiny spinner. This eliminates the layout shift.
- Verify React Query `staleTime` on the main hooks (`useActiveCollabs`, `useWorkspaceCollaborators`, etc.) — if it's the default `0`, set it to `30_000` so back-navigation is instant.

**B. Landing page perf**
- Add `loading="lazy"` + `decoding="async"` to any `<img>` below the fold (testimonials avatars, roadmap icons if any).
- Recharts components: dynamic-import the chart sections via `React.lazy` + `Suspense` so the hero paints before the chart bundle arrives.

**C. Mobile UI fixes (from your screenshots)**

*Screenshot 1 — `BottomCTASection.tsx`:* The orange CTA button bleeds outside the white card on 390px viewport because `size="xl"` has fixed horizontal padding wider than the card's inner width.
- Make the button `w-full sm:w-auto` and reduce horizontal padding at mobile breakpoint, or add `max-w-full` so it wraps inside the card.

*Screenshot 2 — `Navbar.tsx`:* "Get Started" gets clipped by the right edge because the glass pill + Sign In + Get Started exceeds 358px usable width.
- On mobile (`<sm`): collapse "Sign In" into a smaller ghost link, shrink button paddings, OR hide "Sign In" and keep only "Get Started" (users can still reach login via the auth page).
- Recommended: reduce both buttons to `size="sm"` on mobile and tighten the pill's `px-6` to `px-3` under `sm`.

**D. Pricing teaser**
- New small section between `FeatureRoadmapSection` and `BottomCTASection`: two minimal cards (Free / Pro $14.99/mo per existing memory), with a "See full details" link to `/dashboard/subscription`. Keep it understated — matches the "Sam Filter" non-corporate tone.

**E. SEO meta**
- Update `<title>` and `<meta name="description">` in `index.html` to include "newsletter collaboration" + "Substack" keywords, without keyword-stuffing.

### Files

| File | Change |
|---|---|
| `src/components/ScrollToTop.tsx` | New — scroll reset on route change |
| `src/App.tsx` | Mount `<ScrollToTop />` inside `BrowserRouter` |
| `src/components/landing/BottomCTASection.tsx` | Mobile: `w-full sm:w-auto` button, padding fix |
| `src/components/layout/Navbar.tsx` | Mobile: shrink buttons + pill padding so nothing clips |
| `src/components/landing/TestimonialsSection.tsx` | Add `loading="lazy"` to avatar imgs |
| `src/components/landing/RealityOfGrowthSection.tsx` | Wrap chart in `React.lazy` + `Suspense` skeleton |
| `src/components/landing/PricingTeaserSection.tsx` | New — Free vs Pro mini-cards |
| `src/pages/Landing.tsx` | Insert `<PricingTeaserSection />` |
| `index.html` | Title + meta description SEO update |
| `src/hooks/useActiveCollabs.ts` + similar | Add `staleTime: 30_000` to React Query configs |
| `src/pages/Requests.tsx`, `MyRequests.tsx`, `Dashboard.tsx` | Replace null/spinner loading states with sized skeletons |

### Out of scope
- Inventing user-count claims ("500+ writers")
- Fake integration badges for Ghost/Beehiiv
- Demo video production
- WebP conversion (no raster assets to convert)

