

## Collaboration Mode: Async vs. Discovery

You've identified a fundamental product fork: some creators (like you) want **async-first** collaborations focused on shipping drafts, while others want **call-first** discovery conversations. Currently, DraftKit tries to serve both with a single calendar that's causing confusion.

---

### The Core Problem

Today's system has:
- A single "Date Meaning" setting (kickoff/publish/live/flexible)
- Multiple collaboration types selectable simultaneously
- But visitors still think "calendar = meeting"

This creates cognitive dissonance: Anna and Dominik expect Calendly-like scheduling, but your flow is "pick a deadline, start drafting."

---

### The Mode Solution

Instead of making the calendar do two jobs, let creators explicitly declare their **Collaboration Mode** at the top level of their Playbook settings. This single choice cascades through the entire experience.

| Setting | Mode A: "Async Workspace" | Mode B: "Discovery First" |
|---------|---------------------------|---------------------------|
| **Calendar header** | "Select a Target Publication Date" | "Pick a Time to Chat" |
| **Available = ...** | Days you can ship | Days you're free for calls |
| **What happens after booking** | Guest gets draft outline | Guest gets calendar invite |
| **Confirmation copy** | "Check your email for the first draft" | "Check your email for a meeting link" |
| **Badge on profile** | "100% Async" | "Let's Chat First" |

---

### Why One Mode Per Creator (Not Per Collab Type)

Trying to mix modes (e.g., "Async Drafting uses publish dates" + "Virtual Coffee uses live dates") creates a UX nightmare where the calendar changes meaning based on what the guest selects. 

The cleaner approach: **You pick your style, the UI adapts everywhere.**

---

### Database Changes

**Modify the `creators` table:**

| Column | Type | Description |
|--------|------|-------------|
| `collab_mode` | text | `'async'` or `'discovery'` (default: `'async'`) |

The existing `date_meaning` column becomes derived from `collab_mode`:
- `async` mode → dates mean "publish" or "kickoff" (creator picks which)
- `discovery` mode → dates mean "live" (call slots)

---

### Settings UI Changes

**Replace the current Date Meaning radio group with a Mode selector:**

```
┌─────────────────────────────────────────────────────────────┐
│ How do you prefer to collaborate?                          │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✍️  Async Workspace (Recommended for you)               │ │
│ │    Skip the calls. Guests request a topic, you start    │ │
│ │    drafting. Calendar shows publication deadlines.      │ │
│ │                                                          │ │
│ │    "100% Async" badge shown on your booking page         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☕  Discovery First                                      │ │
│ │    Meet collaborators on a call before committing.      │ │
│ │    Calendar shows available call slots.                 │ │
│ │                                                          │ │
│ │    Integrates with Calendly/Cal.com (future)             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

If **Async Workspace** is selected, show a sub-option:
- "Dates represent **kick-off** days (when we start)"
- "Dates represent **publication** days (when we ship)"

---

### Public Booking Page Changes

**For Async Mode creators:**

1. **Badge near profile name**: "100% Async" with a tooltip explaining "No calls required - we'll start drafting right away"

2. **Calendar header**: "Select a Target Publication Date" (or "Select a Kick-off Date" based on sub-setting)

3. **Process steps** (visual 3-step bar):
   ```
   [1. Topic] → [2. Choose Deadline] → [3. Start Drafting]
   ```

4. **Confirmation message**: "Great! This is our target ship date. Check your email for the first draft."

**For Discovery Mode creators:**

1. **Badge**: "Let's Chat First" 

2. **Calendar header**: "Pick a Time for an Intro Call"

3. **Process steps**:
   ```
   [1. About You] → [2. Schedule Call] → [3. Decide Together]
   ```

4. **Confirmation message**: "Great! Check your email for a calendar invite to discuss your collaboration."

---

### Filter Collaboration Types by Mode

When a creator selects their mode, intelligently filter (or re-order) their available collaboration types:

| Mode | Recommended Types | De-emphasized |
|------|-------------------|---------------|
| Async | Async Drafting, Guest Post Exchange, Interview Style, Co-written Article, Newsletter Shoutout | Virtual Coffee, Live Event |
| Discovery | Virtual Coffee, Live Event / Webinar | Async types still available |

This isn't a hard restriction, just a smart default and UI ordering.

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/` | Add `collab_mode` column to `creators` table with default `'async'` |
| `src/lib/validations.ts` | Add `COLLAB_MODE_OPTIONS` and schema |
| `src/pages/Settings.tsx` | Replace Date Meaning radio with Mode selector + conditional sub-options |
| `src/pages/PublicBooking.tsx` | Render mode-specific badge, calendar header, process steps, confirmation copy |
| `src/components/calendar/CollabCalendar.tsx` | Accept `calendarHeader` prop for dynamic header text |

---

### Visual Preview: Your Booking Page After This Change

```
┌─────────────────────────────────────────────────────────────┐
│          [Your avatar]                                       │
│          Elena Calvillo                                      │
│          ┌──────────────┐                                    │
│          │ 100% Async ✨ │                                    │
│          └──────────────┘                                    │
│                                                              │
│  "Looking forward to crafting something great together..."   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│      ┌──────┐     ┌──────────────┐     ┌──────────────┐     │
│      │  1   │ ─── │      2       │ ─── │      3       │     │
│      │Topic │     │Choose Deadline│    │Start Drafting│     │
│      └──────┘     └──────────────┘     └──────────────┘     │
│                                                              │
│            📅 Select a Target Publication Date               │
│                                                              │
│               [  January 2026  ]                             │
│         Mon  Tue  Wed  Thu  Fri  Sat  Sun                   │
│          ...calendar days...                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Migration Strategy

1. **Default existing creators to `async` mode** (since DraftKit's brand is async-first)
2. Existing `date_meaning` values map to the new sub-option under async mode
3. No breaking changes for current users

---

### Technical Implementation Summary

**Step 1: Database Migration**
- Add `collab_mode TEXT DEFAULT 'async'` to `creators` table

**Step 2: Validation & Types**
- Add `CollabMode` type: `'async' | 'discovery'`
- Add `COLLAB_MODE_OPTIONS` constant with metadata

**Step 3: Settings Page**
- New Mode selector component with visual cards
- Conditional Date Meaning sub-options (only for async mode)
- Reorder collab types based on mode selection

**Step 4: Public Booking Page**
- Fetch `collab_mode` from `public_creator_profiles` view
- Render mode-specific badge with tooltip
- Show 3-step process bar (different content per mode)
- Update calendar header dynamically
- Update confirmation message copy

**Step 5: Email Templates**
- Adjust confirmation email copy based on mode

---

### What This Solves

1. **Your frustration**: Your booking page will clearly say "100% Async" and "Pick a Publication Date" - no confusion with calls

2. **Anna/Dominik's expectations**: Call-first creators can set Discovery mode and the UI will feel like Calendly

3. **Future flexibility**: We can later add calendar integrations (Cal.com, Calendly) specifically for Discovery mode creators

4. **Product positioning**: DraftKit becomes the tool for async-first creators, with discovery mode as an option - not the other way around

