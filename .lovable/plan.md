

# Improve Date Clarity for Creators Setting Their Calendar

## Problem
While the guest-facing booking page now clearly explains async collaboration, **creators setting their own availability lack context** about what their date selections mean to guests. This creates a disconnect between creator intent and guest expectations.

## What's Already Working
- Guest booking page has the "How async collaboration works" explainer
- Mode-aware headers and legend text on public pages
- Availability page title says "Publishing Windows" for async mode

## Gaps Identified

### 1. Availability Page - No Guest Preview Context
**Current state**: Instructions explain *how* to click dates, but not *what guests see*
**Problem**: Creators don't understand the downstream effect of their date selections

### 2. Dashboard Calendar - Vague Empty State
**Current state**: "No availability set yet. Click 'Edit Availability' to mark dates when you can ship."
**Problem**: "when you can ship" is internal jargon, not clear what guests experience

### 3. Calendar Legend - Not Mode-Aware in Edit Mode
**Current state**: Default legend says "Available" even in async mode
**Problem**: Inconsistent terminology between edit view and guest view

### 4. Settings Page - Disconnected Date Meaning
**Current state**: "What do your available dates represent?" with Kick-off/Publishing options
**Problem**: No preview of how this affects the guest's booking experience

---

## Proposed Changes

### 1. Add "Guest Preview" Context to Availability Page

**File**: `src/pages/Availability.tsx`

Add a new info card below the instructions that shows what guests will see:

```
+---------------------------------------------------------------+
| 👁️ What guests will see                                       |
|                                                                |
| When someone visits your booking page, they'll be asked to:   |
| "When should this go live?" and pick from your green dates.   |
|                                                                |
| They'll see a note explaining this is a TARGET PUBLISH DATE,  |
| not a meeting.                                                 |
+---------------------------------------------------------------+
```

For discovery mode, the text changes to explain guests will see "call slots".

### 2. Update Dashboard Empty State Copy

**File**: `src/pages/Dashboard.tsx`

**Current**:
```
"No availability set yet. Click 'Edit Availability' to mark dates when you can ship."
```

**Proposed (async mode)**:
```
"No publishing windows set. Click 'Edit Availability' to set dates when you can ship — guests will pick from these as target publish dates."
```

**Proposed (discovery mode)**:
```
"No call slots set. Click 'Edit Availability' to mark when you're free — guests will book intro calls on these dates."
```

### 3. Pass collabMode to Calendar Legend in Edit Mode

**File**: `src/pages/Availability.tsx`

Currently the `CollabCalendar` in edit mode doesn't receive `availableLegendText`. Add mode-aware legend:

```tsx
<CollabCalendar
  ...existing props...
  availableLegendText={
    creator.collab_mode === 'discovery' 
      ? 'Available for calls' 
      : 'Open for publishing'
  }
  collabMode={creator.collab_mode as 'async' | 'discovery' | null}
/>
```

### 4. Add Settings Preview Card

**File**: `src/pages/Settings.tsx`

Below the "What do your available dates represent?" selector, add a preview of what guests see:

```
+---------------------------------------------------------------+
| Preview: How guests will interpret your dates                  |
|                                                                |
| Calendar header: "When Should This Go Live?"                   |
| Selected date means: "This is our target publish date"         |
+---------------------------------------------------------------+
```

This updates dynamically based on the selected date_meaning option.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Availability.tsx` | Add "What guests will see" info card, pass mode-aware legend to calendar |
| `src/pages/Dashboard.tsx` | Update empty state text to explain guest experience |
| `src/pages/Settings.tsx` | Add preview card showing guest-facing date interpretation |

---

## Detailed Implementation

### Availability.tsx - Guest Preview Card

Insert after the existing instructions card (around line 235):

```tsx
{/* Guest Preview Context */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.15 }}
  className="glass-card p-4 mb-6 flex items-start gap-3 bg-accent/10 border border-accent/20"
>
  <span className="text-lg">👁️</span>
  <div className="text-sm text-muted-foreground">
    <p className="font-medium text-foreground mb-1">What guests will see</p>
    {creator.collab_mode === 'discovery' ? (
      <p>Guests will pick from your <span className="text-available font-medium">green dates</span> to schedule an intro call. They'll receive a calendar invite after booking.</p>
    ) : (
      <p>Guests will pick from your <span className="text-available font-medium">green dates</span> as a target publish date. They'll understand this is when you aim to ship — not a meeting.</p>
    )}
  </div>
</motion.div>
```

### Availability.tsx - Mode-Aware Calendar

Update the CollabCalendar component (around line 243):

```tsx
<CollabCalendar
  availableDates={availableDates}
  blockedDates={blockedDates}
  bookedDates={bookedDates}
  bookingDetails={bookingDetails}
  isEditable={true}
  onToggleAvailable={handleToggleAvailable}
  onToggleBlocked={handleToggleBlocked}
  availableLegendText={
    creator.collab_mode === 'discovery' 
      ? 'Available for calls' 
      : 'Open for publishing'
  }
  collabMode={creator.collab_mode as 'async' | 'discovery' | null}
/>
```

### Dashboard.tsx - Updated Empty State

Update the emptyStateText (around line 177-179):

```tsx
const emptyStateText = creator.collab_mode === 'discovery'
  ? "No call slots set. Click 'Edit Availability' to mark when you're free — guests will book intro calls on these dates."
  : "No publishing windows set. Click 'Edit Availability' to set dates when you can ship — guests will pick from these as target publish dates.";
```

### Settings.tsx - Date Meaning Preview

Add a preview card after the date meaning selector (around line 638):

```tsx
{/* Preview of guest experience */}
<div className="p-3 bg-muted/50 rounded-lg border border-border/50 mt-3">
  <p className="text-xs text-muted-foreground">
    <span className="font-medium text-foreground">Guest will see:</span>{" "}
    "{formData.dateMeaning === 'kickoff' 
      ? 'This is the day we start working together' 
      : 'This is our target publish date'}"
  </p>
</div>
```

---

## Visual Comparison

### Availability Page - Before vs After

**Before:**
```
Publishing Windows
Set the dates when collaborations can target going live

[Instructions: How to click dates...]

[Calendar]
```

**After:**
```
Publishing Windows  
Set the dates when collaborations can target going live

[Instructions: How to click dates...]

[👁️ What guests will see]
Guests will pick from your green dates as a target publish date.
They'll understand this is when you aim to ship — not a meeting.

[Calendar with "Open for publishing" legend]
```

---

## Why This Matters

By showing creators **what guests experience**, we:
1. Reduce confusion about async vs sync mental models
2. Build confidence that their calendar setup communicates correctly
3. Close the feedback loop between creator intent and guest perception

