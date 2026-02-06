
# Clarify Async Collaboration Model for Better User Understanding

## Problem Statement
User feedback from Dinah reveals a fundamental intent mismatch: users see a calendar and assume they're scheduling a meeting (like Calendly), but DraftKit's async mode is about setting **target publication dates**, not scheduling calls. The current copy doesn't make this distinction prominent enough.

## Root Cause Analysis
Looking at the current implementation, I found:

1. **Calendar header says**: "Select a Target Publication Date" - but users skim past this
2. **Small disclaimer exists** (line 1349-1352): "This is not a meeting. It's the date we aim to publish on Substack" - but it's too subtle (tiny text, low contrast)
3. **"Availability" terminology** in the creator's dashboard and instructions reinforces the meeting mental model
4. **No visual differentiation** between async mode (publication dates) and discovery mode (call slots)

---

## Proposed Changes

### 1. Add "How This Works" Explainer Banner Above Calendar

**Location**: `src/pages/PublicBooking.tsx` (before the calendar, around line 1337)

Add a prominent, always-visible explainer card when `collab_mode === 'async'`:

```
+------------------------------------------------------------+
|  ✍️  How async collaboration works                         |
|                                                            |
|  1. You pick a target ship date (not a meeting)            |
|  2. [Creator] shares a draft for your review               |  
|  3. You refine together asynchronously — no calls needed   |
+------------------------------------------------------------+
```

This uses Dinah's exact concern ("without scheduling a time to meet") and addresses it directly.

### 2. Rename "Availability" to "Publishing Windows" for Async Mode

**Files to update**:
- `src/pages/Availability.tsx` - Header and descriptions
- `src/lib/validations.ts` - Mode metadata

**Current**:
- Page title: "Availability"
- Description: "Set the dates when you're available for collaborations"

**Proposed (when async mode)**:
- Page title: "Publishing Windows"
- Description: "Set the dates when you can target a collaboration publish date"

### 3. Improve Calendar Legend Text

**File**: `src/lib/validations.ts` (line 80-86 in PublicBooking.tsx helper)

**Current legend text for async**:
- "Available" or "Available to publish"

**Proposed**:
- "Open for publishing" or "Target ship dates"

### 4. Add Tooltip to "100% Async" Badge

**File**: `src/pages/PublicBooking.tsx` (line 707-709)

**Current tooltip**: "No calls required – we'll start drafting right away"

**Proposed enhanced tooltip**: 
"This creator works 100% asynchronously — you'll collaborate on a shared draft, not schedule calls. Pick a target publish date to get started."

### 5. Update Process Steps Labels for Clarity

**File**: `src/lib/validations.ts` (lines 149-153)

**Current**:
```
processSteps: [
  { step: 1, label: 'Topic' },
  { step: 2, label: 'Ship Date' },
  { step: 3, label: 'Drafting' },
]
```

**Proposed**:
```
processSteps: [
  { step: 1, label: 'Your Idea' },
  { step: 2, label: 'Target Date' },
  { step: 3, label: 'Draft Review' },
]
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/PublicBooking.tsx` | Add "How This Works" explainer card above calendar for async mode |
| `src/lib/validations.ts` | Update async mode metadata (processSteps, calendarHeader, badgeTooltip) |
| `src/pages/Availability.tsx` | Add mode-aware title/description (would require passing collab_mode from creator) |
| `src/components/calendar/CollabCalendar.tsx` | Update fallback legend text and toast messages |

---

## Detailed Implementation

### PublicBooking.tsx - Add Explainer Card

Insert before the calendar (around line 1337):

```tsx
{/* Async Mode Explainer - Prominent */}
{creator.collab_mode === 'async' && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-6 p-4 bg-accent/30 border border-accent/50 rounded-xl"
  >
    <div className="flex items-start gap-3">
      <span className="text-xl">✍️</span>
      <div>
        <h4 className="font-semibold text-sm mb-2">How async collaboration works</h4>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>You pick a <span className="font-medium text-foreground">target publish date</span> (not a meeting)</li>
          <li>{creator.name} shares a draft for your review</li>
          <li>Refine together asynchronously — no calls needed</li>
        </ol>
      </div>
    </div>
  </motion.div>
)}
```

### validations.ts - Update Async Metadata

```typescript
async: {
  label: 'Async Workspace',
  description: 'Skip the calls. Guests pick a topic, you start drafting. Calendar shows target publish dates.',
  badge: '100% Async',
  badgeTooltip: 'No meetings — you\'ll collaborate on a shared draft. Pick a target date to publish.',
  calendarHeader: 'When Should This Go Live?',
  confirmationText: 'Great! This is our target publish date. Check your email for next steps on drafting.',
  processSteps: [
    { step: 1, label: 'Your Idea' },
    { step: 2, label: 'Target Date' },
    { step: 3, label: 'Draft Review' },
  ],
  icon: '✍️',
},
```

### Availability.tsx - Mode-Aware Title

This requires fetching the creator's collab_mode (already available in the creator object):

```tsx
<h1 className="text-3xl font-bold mb-2">
  <span className="gradient-text">
    {creator.collab_mode === 'discovery' ? 'Availability' : 'Publishing Windows'}
  </span>
</h1>
<p className="text-muted-foreground">
  {creator.collab_mode === 'discovery' 
    ? 'Set the dates when you\'re available for intro calls'
    : 'Set the dates when collaborations can target going live'}
</p>
```

---

## Visual Comparison

**Before (current state):**
```
[100% Async badge]

Select a Target Publication Date
When do you want this collaboration to go live?
(tiny text) This is not a meeting...

[Calendar grid]
```

**After (proposed):**
```
[100% Async badge with enhanced tooltip]

+------------------------------------------+
| ✍️ How async collaboration works         |
|   1. Pick a target publish date (not a   |
|      meeting)                            |
|   2. Creator shares a draft for review   |
|   3. Refine together — no calls needed   |
+------------------------------------------+

When Should This Go Live?
Select your target publish date

[Calendar grid with "Open for publishing" legend]
```

---

## Technical Notes

1. **No database changes required** - This is purely UI/copy changes
2. **No new components needed** - Uses existing motion.div patterns
3. **Respects existing collab_mode logic** - Discovery mode remains unchanged
4. **Follows Sam Filter brand principle** - Uses "Professional Utility" language, no AI buzzwords

---

## Success Metrics

After implementation, monitor:
- Reduction in support questions about "what the date means"
- Increased completion rate on async mode bookings
- User feedback mentioning clarity about async workflow

