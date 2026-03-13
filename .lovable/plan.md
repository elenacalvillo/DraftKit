

# Rebuild HowItWorksSection — 6 Pillar "Roadmap to Growth"

## Changes to `src/components/landing/HowItWorksSection.tsx`

**Full rewrite** of the component:

### Data: 6 pillars array
| # | Icon | Title | Description |
|---|------|-------|-------------|
| 01 | `Search` | Smart Discovery | Find the right voices even when standard search fails. We look at the source to find collaborators ready to grow with you. |
| 02 | `Send` | The Front Door | Replace messy DMs with a professional request page. When you invite a partner to join, you both earn a collaboration credit. |
| 03 | `Zap` | The Smart Draft | Start with a workspace that is already 50 percent finished. We pull the research and context so you never start from zero. |
| 04 | `Users` | The Shared Room | One home for the draft and the conversation. Eliminate email threads and messy document permissions forever. |
| 05 | `Gift` | The Growth Loop | DraftKit grows when you grow. Earn extra collaboration credits for every writer you bring into the community. |
| 06 | `Trophy` | The Milestone | Export to Substack in one click with all formatting preserved. No more copy pasting or fixing broken links. |

### Header
- Headline: "How we break the loneliness wall"
- Subheadline: "We automate the busywork so you can focus on the relationship."

### Grid & Cards
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — 3×2 layout on desktop
- Max width: `max-w-6xl` (wider than current `max-w-5xl` to fit 3 columns)
- Each card: `glass-card p-6 h-full border-l-2 border-primary/40 hover:border-primary/50 transition-colors`
- Icon container: orange gradient background (`gradient-primary`), white icon, all icons use `color="#f47458"` on the Lucide component but rendered white via `text-primary-foreground` on the container
- Number + title row, then description below
- Staggered framer-motion entrance (delay: `index * 0.1`)

### Single file change
Only `src/components/landing/HowItWorksSection.tsx` is modified.

