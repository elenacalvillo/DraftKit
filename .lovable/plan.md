
## Redefining the Dashboard Metrics as "Value Signals"

### What's Currently Broken

**Three compounding issues** are making the stats block a "dead zone":

1. **"Collabs This Month" is blind to Published status** — line 139 filters `r.status === "approved"` only. A collab that moved to `published` (your actual win) does not count.

2. **The three metrics describe activity, not outcomes** — "Outlines Created," "Pending Requests," and "Collabs This Month" are backend counters with no business story.

3. **The icon colors use `text-success` (neon green) and `text-accent`** — against the brand dark (`#2a2318`) / coral palette, these read as off-brand.

---

### The Three New Metrics

| Card | New Label | Logic | Format |
|---|---|---|---|
| Card 1 | **Ship Rate** | `(published count / total non-pending, non-cancelled requests) * 100` | `"72%"` with subLabel "Requests turned into published work" |
| Card 2 | **Collaborator Reach** | Count of unique `requester_substack_url` values across all requests (deduplicated by URL). Represents distinct newsletter audiences touched. | `"3 Newsletters"` with subLabel "Unique audiences reached" |
| Card 3 | **Time Saved Drafting** | `(ai_draft !== null count) * 1.5 hours` — each AI draft generated saves ~90 min of research + drafting time, shown as `"4.5 hrs"` | `"4.5 hrs"` with subLabel "Estimated drafting time saved" |

All three are calculated client-side from the already-fetched `requests` array — no new database queries needed.

---

### The Ship Rate Formula

```
eligible = requests where status is NOT 'pending' and NOT 'cancelled'
published = requests where status === 'published'
shipRate = eligible.length > 0 ? Math.round((published.length / eligible.length) * 100) : 0
display = shipRate + "%"
```

If `eligible.length === 0`, display `"—"` (em dash) instead of "0%" to avoid a discouraging zero on a fresh account.

---

### Collaborator Reach Formula

```
uniqueUrls = new Set(
  requests
    .filter(r => r.requester_substack_url)
    .map(r => r.requester_substack_url.trim().toLowerCase())
)
reach = uniqueUrls.size
display = reach + (reach === 1 ? " Newsletter" : " Newsletters")
```

Note: `requester_substack_url` is already in the select query on line 100 — we need to add it. Currently the query only selects specific columns. We'll add `requester_substack_url` to the select.

---

### Time Saved Formula

```
draftsGenerated = requests.filter(r => r.ai_draft !== null).length
hoursSaved = draftsGenerated * 1.5
display = hoursSaved % 1 === 0 ? hoursSaved + " hrs" : hoursSaved.toFixed(1) + " hrs"
```

Empty state: `"0 hrs"` → show tip "Generate your first SMART draft to start tracking time saved"

---

### Icon & Color Changes

The current colors use Tailwind utility classes that map to CSS variables:
- `text-primary` → coral (correct, keep for Card 1)  
- `text-accent` → this is the neon yellow/green that feels off-brand → change to use a custom inline style `color: '#2a2318'` (brand dark) with `bg: 'bg-[#2a2318]/10'`
- `text-success` → neon green → same treatment, swap to coral-adjacent

New color scheme (all on-brand):
- **Ship Rate** (Card 1): Icon `TrendingUp` — `text-primary` / `bg-primary/10` (coral — represents growth)
- **Collaborator Reach** (Card 2): Icon `Globe` — `color: #c17f5c` / background `#c17f5c1a` (terracotta, second coral shade)
- **Time Saved** (Card 3): Icon `Zap` — `color: #2a2318` / background `#2a231810` (brand dark — premium, grounded)

Icons imported from `lucide-react`: swap `Users` for `TrendingUp`, `Clock` for `Globe`, `Calendar` for `Zap`.

---

### What Stays the Same

- The "Recent Requests" list on the right — no change
- The calendar section — no change
- The "Share Your Link" card — no change
- Database queries — **one small addition**: add `requester_substack_url` to the `select()` on line 100

---

### Files Changed

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | (1) Add `requester_substack_url` to the select query. (2) Replace three metric calculations with Ship Rate, Collaborator Reach, and Time Saved. (3) Update `stats` array with new labels, icons, colors, display values, and empty state tips. (4) Update icon imports. |

No database changes. No new dependencies. No edge function changes.

---

### Empty State Tips (New Copy)

- **Ship Rate (0):** "Approve and publish your first collab to track your closing rate"
- **Collaborator Reach (0):** "Each requester's newsletter counts — your first request is your first audience reached"
- **Time Saved (0 hrs):** "Generate a SMART draft to start tracking how much drafting time DraftKit saves you"
