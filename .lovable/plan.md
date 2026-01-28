

## Personalize "How It Works" Section on Public Booking Page

The current "HOW IT WORKS" header feels corporate and impersonal. We'll make it feel more like "Elena's process" rather than a generic tool explanation.

---

### Changes Overview

| File | Change |
|------|--------|
| `src/pages/PublicBooking.tsx` | Update headline styling and make it personal/dynamic |
| `src/lib/validations.ts` | Update async mode process step labels to match "Ship Date" mental model |

---

### 1. Make the Headline Personal and Bold

**Current:**
```html
<p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-3">
  How it works
</p>
```

**Proposed:**
```html
<h4 className="text-sm font-semibold text-foreground text-center mb-4">
  My collaboration process
</h4>
```

**Why "My collaboration process":**
- Personal ("My") — feels like the creator's own workflow
- Professional — "collaboration process" is clear and sets boundaries
- Not corporate — avoids generic "How It Works" template feel

**Alternative options if preferred:**
- "How I work" (most direct)
- "My drafting process" (async-specific)
- "How we'll collaborate" (inclusive but still personal)

---

### 2. Update Async Mode Process Steps

The current labels reinforce a "calendar booking" mental model that confuses guests like Dominik.

**Current (Async mode):**
| Step | Label |
|------|-------|
| 1 | Topic |
| 2 | Choose Deadline |
| 3 | Start Drafting |

**Proposed (Async mode):**
| Step | Label |
|------|-------|
| 1 | Topic |
| 2 | Ship Date |
| 3 | Drafting |

**Why these changes:**
- "Ship Date" reinforces publication milestone (not a meeting)
- "Drafting" is shorter and cleaner than "Start Drafting"
- Eliminates ambiguity about what the date represents

---

### 3. Keep Discovery Mode Steps (Already Clear)

The discovery mode steps already work well:
- About You → Schedule Call → Decide Together

These clearly communicate a meeting-first flow, so no changes needed.

---

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/pages/PublicBooking.tsx` | ~639-641 | Change `<p>` to `<h4>`, update text to "My collaboration process", update styling |
| `src/lib/validations.ts` | ~149-153 | Update async `processSteps` labels: "Choose Deadline" → "Ship Date", "Start Drafting" → "Drafting" |

---

### Visual Before/After

**Before:**
```
HOW IT WORKS (tiny, uppercase, muted)

   1         2              3
 Topic   Choose Deadline   Start Drafting
```

**After:**
```
My collaboration process (bold, readable)

   1         2              3
 Topic    Ship Date       Drafting
```

