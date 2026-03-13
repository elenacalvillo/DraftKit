

# Landing Page Overhaul — Data-Driven Premium Redesign

There is no "Dinah interview" section in the current codebase — I'll note this and protect all existing content (testimonials from Stefania, Karo, Dheeraj + the "Your guest is never the subscriber" banner). Recharts is already installed.

## Architecture

The landing page currently has 4 sections. After the update it will have 8, composed in `Landing.tsx`:

```text
Navbar
HeroSection          (updated badge, CTA text, microcopy)
RealityOfGrowthSection   (NEW — 3 Recharts bento cards)
BusyworkComparisonSection (NEW — side-by-side old vs new)
HowItWorksSection    (updated descriptions only)
TestimonialsSection  (PROTECTED — no changes)
FeatureRoadmapSection (FAQ — add 2 new Q&As + grid styling)
BottomCTASection     (NEW — "Grow first. Pay later.")
Footer
```

## File Changes

### 1. `src/components/landing/HeroSection.tsx` — Update in place
- Change badge text to `"Built to solve the 8.5-hour busywork tax"`
- Change primary CTA to `"Start your first collab (Free)"`
- Add microcopy `"No credit card. No time limits."` below buttons
- Update the 4 step descriptions:
  - 01: "A professional front door that replaces messy DMs."
  - 02: "Start 50% finished. No more blank pages."
  - 03: "One room for the partnership and the draft. No more email threads."
  - 04: "Export to Substack in one click. No more copy-paste."

### 2. `src/components/landing/RealityOfGrowthSection.tsx` — NEW
Three bento-grid cards with Recharts visualizations using `#f47458`:
- **Card 1 (Discovery Gap)**: `BarChart` — passive recs drive <5% growth under 1k subs. Label: "The algorithm is not coming to save you."
- **Card 2 (Loneliness Wall)**: `AreaChart` with gradient fill — 75% quit rate at 100-500 subs. Label: "75% of writers quit before 500 subs."
- **Card 3 (Inner Circle)**: `PieChart` (donut) — 60% elite growth from high-coordination collabs. Label: "The top 1% grow through collaboration."
- All cards use `glass-card` styling, `motion.div` `whileInView` entrance animations, staggered delays.

### 3. `src/components/landing/BusyworkComparisonSection.tsx` — NEW
Side-by-side comparison with section title "Reclaim your creative time."
- **Left panel**: "The Old Way" — animated staggered list with Mail, FileText, Calendar icons. Label: "12+ emails. 3 apps. 8.5 hours of busywork." Items fade in with strikethrough animation.
- **Right panel**: "The DraftKit Way" — clean card showing workspace icon with checkmarks. Label: "One room. Zero busywork. 8 hours saved."
- CTA: `"Save your first 8 hours (Free)"` hero button linking to `/signup`.

### 4. `src/components/landing/HowItWorksSection.tsx` — Update descriptions
Keep structure, update text only:
- 01: "Send a professional front-door invite that replaces messy DMs."
- 02: "Start with a structure that's already 50% finished. No more blank pages."
- 03: 'One shared room for the partnership and the draft. No more "which version is this?" email threads.'
- 04: "Export to Substack with one click. No more copy-paste or broken links."

### 5. `src/components/landing/TestimonialsSection.tsx` — NO CHANGES
Protected. Stefania, Karo, Dheeraj testimonials + guest banner preserved.

### 6. `src/components/landing/FeatureRoadmapSection.tsx` — Add 2 FAQ items + grid update
Add two new questions to the `principles` array:
- "Is this just another AI content factory?" → "Actually, it's the opposite..."
- "Why not just use the Substack Recommendation engine?" → "Because the data shows..."
Update grid to `md:grid-cols-2 lg:grid-cols-3` for 5 items. Replace bottom strip with the new BottomCTA section.

### 7. `src/components/landing/BottomCTASection.tsx` — NEW
- Headline: "Grow first. Pay later."
- Primary: "Your first 3 published collaborations are free."
- Secondary: "No credit card. No 7-day trial limits. Just human growth."
- Button: "Get your 3 free collaborations (Free)" linking to `/signup`.
- Soft gradient background, centered layout.

### 8. `src/pages/Landing.tsx` — Add new sections
Import and add `RealityOfGrowthSection`, `BusyworkComparisonSection`, `BottomCTASection` in the correct sequence order.

## Design Tokens
- All charts use `#f47458` (DraftKit orange) as primary data color
- Bento cards use `glass-card` + subtle `border-primary/20` accents
- All entrance animations use `whileInView` with `viewport={{ once: true }}`
- Consistent `py-24 px-6` section spacing
- Every CTA includes "(Free)" in button text

