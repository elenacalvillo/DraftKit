# Showcase Discovery Engine on Landing Page

Three changes across 3 files. One new component.

## 1. New Component: `DirectDiscoveryCard.tsx`

Create `src/components/landing/DirectDiscoveryCard.tsx` — a standalone feature card placed between `RealityOfGrowthSection` and `BusyworkComparisonSection` in `Landing.tsx`.

**Content:**

- Title: "Find new voices to grow with."
- Body text: "The best way to grow is to find the right partners early. We help you discover new writers and fresh audiences to collaborate with. If someone has a publication online, you can find them here and start building something together today."
- Animated SVG graphic: two dots (A and B) with a direct orange line connecting them, and a faded "cloud" shape labeled "Search Index" that the line bypasses. Use framer-motion to animate the direct line drawing in (pathLength 0→1) and the cloud fading out slightly.
- Glass card styling consistent with existing sections, centered layout, max-w-3xl

## 2. Update `FeatureRoadmapSection.tsx` — Add new FAQ

Add a 6th entry to the `principles` array:

```
Q: "What if my Substack doesn't show up in search yet?"
A: "It doesn't have to. DraftKit uses direct metadata resolution and archive indexing. If your publication is live on the web, we can find it, connect it, and start growing it immediately."
```

## 3. Update `Footer.tsx` — Technical badge

Add a small muted badge below the existing footer content (before the closing `</footer>` or inside the container):

```
<div className="text-center mt-6 pt-6 border-t border-border/30">
  <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 font-mono tracking-wider uppercase">
    <Zap className="w-3 h-3" />
    Powered by Direct Metadata Resolution v1.0
  </span>
</div>
```

## 4. Update `Landing.tsx` — Insert new section

Import and place `<DirectDiscoveryCard />` between `RealityOfGrowthSection` and `BusyworkComparisonSection`.

## Files


| File                                               | Change                                       |
| -------------------------------------------------- | -------------------------------------------- |
| `src/components/landing/DirectDiscoveryCard.tsx`   | New — feature card with animated A→B graphic |
| `src/components/landing/FeatureRoadmapSection.tsx` | Add 6th FAQ entry                            |
| `src/components/layout/Footer.tsx`                 | Add technical badge                          |
| `src/pages/Landing.tsx`                            | Import and place DirectDiscoveryCard         |
