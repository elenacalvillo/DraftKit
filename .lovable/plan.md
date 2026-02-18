
# Landing Page Overhaul: From "Scheduling Tool" to "Collaboration Engine"

## What's Changing and Why

The current landing page sends the wrong signal. The hero says "Sync schedules," the HowItWorks section is titled "From first hello to meaningful conversation," and the FeatureRoadmap leads with "Collaborative Scheduling." Every word positions DraftKit as a niche Calendly. The product has shipped a Shared Workspace, SMART drafts, .docx exports, and retrospective banners — none of which are visible on the page.

This overhaul rewrites all four landing sections plus updates the Hero to position DraftKit as an **Execution Engine**: the place where structured pitches, SMART drafts, and milestone celebrations live. Scheduling is a step in the loop, not the product.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/landing/HeroSection.tsx` | Full rewrite — new headline, subhead, CTAs, and Product Loop preview replacing the three feature cards |
| `src/components/landing/HowItWorksSection.tsx` | Full rewrite — renamed to "The Product Loop," four steps instead of three, execution-focused copy |
| `src/components/landing/TestimonialsSection.tsx` | Header copy refresh + add "Guest Principle" card at the end of the row |
| `src/components/landing/FeatureRoadmapSection.tsx` | Renamed to "Core Principles" — Strategic FAQ replacing the roadmap list, removes waitlist form |
| `src/components/layout/Footer.tsx` | Tagline update: "Simplifying creator collaborations" → "The engine for creators who ship together" |

---

## Section-by-Section Design

### 1. Hero Section

**Badge:** `Zap` icon — "Built for creators who ship, not just schedule"

**Headline (two lines):**
```
Stop chasing drafts.
Start shipping together.
```
The gradient applies to the second line.

**Subhead:**
> One link to handle the pitch, the research, and the writing. DraftKit is the shared workspace built for creators who value their time — and their collaborators.

**CTAs:**
- Primary (hero variant, xl): "Start Drafting — It's Free" with `ArrowRight`
- Secondary (glass variant, lg): "See a Demo Workspace" → `/demo`

**Below the CTAs — Product Loop Preview (replaces feature cards):**
Instead of three avatar cards, show a horizontal 4-step mini-loop using numbered pill labels and a short title. No avatars — this is workflow, not social proof:

```text
[01 The Pitch] → [02 The SMART Draft] → [03 The Workspace] → [04 The Milestone]
```

Each step is a compact `glass-card` with a number badge (coral gradient), a bold step name, and a 1-line descriptor. Arrow connectors between them on desktop, hidden on mobile.

---

### 2. How It Works → "The Product Loop"

Section heading: **"Four steps from idea to published"**
Subhead: "DraftKit handles the research, the writing start, and the celebration. You handle the creativity."

**Steps (4 instead of 3):**

| # | Step Name | Copy |
|---|-----------|------|
| 01 | The Request | Send one link. Your guest fills out a structured pitch with real research — not "let me know what you want to talk about" |
| 02 | The SMART Draft | The AI takes their research and generates a 1,000-word starting point in your tone. You start at 80% done, not zero |
| 03 | The Shared Workspace | A distraction-free "meeting room" for two. No sidebars. No small talk. Just the text |
| 04 | The Milestone | Export to Substack or Word in one click. A retrospective banner closes the loop and celebrates the win |

Each step gets its own icon from lucide-react:
- 01: `Link` (or `Send`)
- 02: `Sparkles`
- 03: `FileText`
- 04: `Trophy`

Layout stays as the 3-column grid but becomes a 2×2 grid on desktop with a card-style treatment (glass-card, left border accent in coral), not bare centered text.

---

### 3. Testimonials Section

**Header copy change:**
- Heading: "What Creators Are Saying" → **"Trusted by creators who ship"**
- Subhead: → "From newsletter writers to PMs — here's what they found when they stopped scheduling and started collaborating"

**"Guest Principle" card** added as a 4th element below the 3-column grid (full-width banner card):

```text
+----------------------------------------------+
| 🚪 "Your guest is never the subscriber."      |
|                                               |
| DraftKit runs on the Meeting Room model.      |
| You own the engine (Pro). Your collaborators  |
| join the ride — always free. No credit cards, |
| no cover charges, no paywalls for the people  |
| who are there to help you write.              |
+----------------------------------------------+
```

Styled as a `glass-card` with a left coral border, a `DoorOpen` or `Users` icon, and a "Learn more →" link to `/demo`.

---

### 4. FeatureRoadmap → "Core Principles" (Strategic FAQ)

**Section heading:** "The honest answers"
**Subhead:** "Built for PMs and creators who ask the right questions before they commit."

Replace the roadmap list and waitlist form with **three principle cards** in a 3-column grid. Each is a `glass-card` with a bold question as the title and a paragraph answer:

**Card 1 — The Guest Question**
> "Does my collaborator need to pay?"
>
> No. We run on the Meeting Room model. You own the house (Pro), so your guests are always welcome for free. They will never hit a paywall just to help you write.

**Card 2 — The Google Docs Question**
> "How is this better than a Google Doc?"
>
> Google Docs are where drafts go to die. DraftKit is where they go to get finished. We automate the research capture, the SMART draft, and the final export. It is a dedicated engine, not a blank sheet of paper.

**Card 3 — The Voice Question**
> "Will the AI sound like me?"
>
> DraftKit uses Prompt-Led Product principles. The AI does not write for you — it writes with you, using the research your guest provided to stay grounded in fact and tone.

Below the three cards, a full-width "Built for the speed of now" strip:
> DraftKit was built fast because we listen to creators. No corporate fluff. No bloated features. Just the tools you need to collaborate at a professional level. — and a single CTA: "Start Drafting Free" linking to `/signup`.

---

## Technical Notes

- All four landing component files are rewritten in-place — no new files, no route changes
- Existing CSS utility classes (`glass-card`, `gradient-text`, `gradient-primary`, `hover-lift`) are reused throughout — no new Tailwind config
- Framer Motion `whileInView` / `viewport={{ once: true }}` patterns preserved from existing sections
- The `TestimonialsSection` keeps all three existing testimonials unchanged — only headers and the guest-principle card are added
- The `FeatureRoadmapSection` drops the Supabase `analytics_events` insert for the waitlist form since it is being replaced with static principle cards
- Footer tagline is a one-line string change
- `HowItWorksSection` becomes a 2×2 card grid on desktop, single column on mobile — matches the glass-card pattern used elsewhere
- Icons used: `Zap`, `ArrowRight`, `Link`, `Sparkles`, `FileText`, `Trophy`, `DoorOpen` — all available in `lucide-react@0.462.0`
