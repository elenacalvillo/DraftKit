

## Dashboard Copy Clarity Update

You're right that the dashboard copy is unclear and doesn't align with DraftKit's brand positioning. Looking at the screenshot:

| Current Copy | Problem |
|--------------|---------|
| "Strategic Outlines" / "AI-powered drafts created" | Violates the "Sam Filter" - too AI-centric |
| "Open Connections" / "Waiting for your response" | Vague - what's a "connection"? |
| "Collaborations This Month" / "Ready to publish" | Misleading - these are approved/scheduled, not "ready" |
| "Your Schedule" | Doesn't reflect async vs discovery mode |

---

### Proposed Changes

**Stat Card 1: Drafts Created**
- **Label**: "Draft Outlines" → "Outlines Created"  
- **Sub-label**: ~~"AI-powered drafts created"~~ → "Ready to refine"
- **Empty tip**: "Review a request to generate your first collaboration outline"

**Stat Card 2: Pending Requests**
- **Label**: ~~"Open Connections"~~ → "Pending Requests"
- **Sub-label**: "Awaiting your review"
- **Empty tip**: "Share your link to start receiving collaboration requests"

**Stat Card 3: This Month's Collaborations**
- **Label**: Keep "Collaborations This Month"
- **Sub-label**: ~~"Ready to publish"~~ → "Scheduled this month"
- **Empty tip**: "Approve requests to fill your calendar"

**Calendar Section Header (Mode-Aware)**
- If `collab_mode === 'async'`: "Your Publication Schedule"
- If `collab_mode === 'discovery'`: "Your Availability"
- Fallback: "Your Schedule"

**Calendar Empty State (Mode-Aware)**
- Async mode: "No availability set yet. Click 'Edit Availability' to mark dates when you can ship."
- Discovery mode: "No availability set yet. Click 'Edit Availability' to mark dates when you're free for calls."

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Update `stats` array labels/sub-labels, add mode-aware calendar header, update empty state copy |

---

### Implementation Details

```typescript
// Updated stats array
const stats = [
  {
    icon: Users,
    label: "Outlines Created",
    subLabel: "Ready to refine",
    value: draftsCreatedCount,
    emptyTip: "Review a request to generate your first collaboration outline",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Clock,
    label: "Pending Requests",
    subLabel: "Awaiting your review",
    value: pendingCount,
    emptyTip: "Share your link to start receiving collaboration requests",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Calendar,
    label: "Collaborations This Month",
    subLabel: "Scheduled this month",
    value: thisMonthCollabs,
    emptyTip: "Approve requests to fill your calendar",
    color: "text-success",
    bg: "bg-success/10",
  },
];

// Mode-aware calendar header
const calendarHeader = creator.collab_mode === 'discovery' 
  ? "Your Availability" 
  : "Your Publication Schedule";

// Mode-aware empty state
const emptyStateText = creator.collab_mode === 'discovery'
  ? "No availability set yet. Click 'Edit Availability' to mark dates when you're free for calls."
  : "No availability set yet. Click 'Edit Availability' to mark dates when you can ship.";
```

---

### Why These Changes

1. **"Outlines Created"** removes AI language while keeping the professional outcome focus
2. **"Pending Requests"** is immediately clear - these are requests waiting for action
3. **"Scheduled this month"** accurately describes approved collaborations on the calendar
4. **Mode-aware headers** reinforce the async/discovery distinction you just added
5. **All empty tips are actionable** - they tell the creator exactly what to do next

