

# Update Demo Page — 6 Pillar Vertical List

## Single file: `src/pages/Demo.tsx`

### Header update
- Headline: "How we break the loneliness wall"
- Subheadline: "We automate the busywork so you can focus on the relationship."

### Replace 4 steps with 6 pillars
Keep the existing vertical list layout and `Step` component structure. Update the data:

| # | Icon | Title | Body |
|---|------|-------|------|
| 01 | `Search` | Smart Discovery | Find the right voices even when standard search fails. We look at the source to find collaborators ready to grow with you. |
| 02 | `Send` | The Front Door | Replace messy DMs with a professional request page. Your invite earns both of you a collaboration credit toward your next growth milestone. |
| 03 | `Zap` | The Smart Draft | Start your collaboration with an AI-powered foundation. We automate the ideation phase so you can focus on high-value writing. |
| 04 | `Users` | The Shared Room | A dedicated workspace for your team. Manage edits, feedback, and final approvals in one centralized location. |
| 05 | `Gift` | The Growth Loop | DraftKit grows when you grow. Earn extra credits for every writer you bring into the community to scale your network. |
| 06 | `Trophy` | The Milestone | Finalize and ship your post instantly. Preserving your layout kills the manual friction that causes most writers to quit. |

### Step component tweak
- Change label from `Step {number}` to zero-padded format: `0{number}` (matching the landing page pillar numbering)

### Imports
- Replace `Calendar, Users, CheckCircle, Heart` with `Search, Send, Zap, Users, Gift, Trophy`

### CTA delay
- Bump CTA transition delay from `0.5` to `0.7` to account for the 6 steps

