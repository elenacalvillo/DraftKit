

# Update "Time Saved" to a Research-Backed Dynamic Formula

## Problem

The current "Time Saved Drafting" metric uses `ai_draft count × 1.5 hrs`, which only measures AI draft generation. It ignores the broader coordination savings DraftKit provides (scheduling, messaging, workspace, etc.). The number barely moves and understates real value.

## New Formula

Based on the "8.5-hour coordination tax" research:

```
Time Saved = published_count × (MANUAL_TAX_HOURS - DRAFTKIT_EFFICIENCY_HOURS)
           = published_count × (8.5 - 1.0)
           = published_count × 7.5
```

- `published_count`: collab requests with `status = 'published'` for the current creator
- `MANUAL_TAX_HOURS = 8.5`: baseline manual coordination time per collab
- `DRAFTKIT_EFFICIENCY_HOURS = 1.0`: estimated DraftKit workflow time

The metric label changes from "Time Saved Drafting" to "Time Saved" with sub-label "vs. manual coordination baseline".

## Changes

### `src/pages/Dashboard.tsx`

1. Replace the `draftsGenerated` / `hoursSaved` calculation:
   - Remove: `const draftsGenerated = requests.filter(r => r.ai_draft !== null).length`
   - Remove: `const hoursSaved = draftsGenerated * 1.5`
   - Add constants: `MANUAL_TAX_HOURS = 8.5`, `DRAFTKIT_EFFICIENCY_HOURS = 1.0`
   - Add: `const publishedCount = publishedRequests.length` (already computed above)
   - Add: `const hoursSaved = publishedCount * (MANUAL_TAX_HOURS - DRAFTKIT_EFFICIENCY_HOURS)`

2. Update the stat card:
   - Label: "Time Saved" (drop "Drafting")
   - Sub-label: "vs. manual coordination baseline"
   - Empty check: `publishedCount === 0` instead of `draftsGenerated === 0`
   - Empty tip: "Publish your first collab to start tracking time saved vs. manual coordination"

No other files change. The `publishedRequests` array is already computed for Ship Rate, so we reuse it.

