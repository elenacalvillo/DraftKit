
## Fix Guest Booking Journey - UX Clarity Improvements

Based on detailed feedback from beta testers (Dominik, Karen, and others), this plan addresses three critical friction points in the public booking flow at `draftkit.app/{username}`.

---

### Issue 1: "Publication vs. Meeting" Confusion

**Problem:** Users think they're booking a meeting/call rather than selecting a target publication date. The current calendar header says "Select a Date" which implies scheduling.

**Solution:** Update calendar headers and add clarifying copy.

**File:** `src/pages/PublicBooking.tsx`

| Location | Current Copy | New Copy |
|----------|--------------|----------|
| Calendar Header (lines 1089-1104) | "Select a Date" | "Target Publication Date" |
| Calendar Subheading | "Choose an available date to collaborate with {name}" | "When do you want this collaboration to go live?" |
| New element | N/A | Add clarifying note under calendar: "This is not a meeting. It's the date we aim to publish on Substack." |

---

### Issue 2: "See Guidelines" Dead-End

**Problem:** When "Custom" collab type is selected, the outcome shows "See guidelines" but there's no actual link or tooltip - it's just dead text.

**Solution:** Replace "See guidelines" with actionable text that doesn't mislead users.

**File:** `src/lib/validations.ts`

```typescript
// FROM
'Custom': { outcome: 'See guidelines', dateMeans: 'See guidelines', icon: '...' }

// TO  
'Custom': { outcome: 'Custom arrangement', dateMeans: 'To be discussed', icon: '...' }
```

**File:** `src/pages/Settings.tsx`

```typescript
// FROM
{ value: "Custom", label: "Custom", description: "See guidelines below" }

// TO
{ value: "Custom", label: "Custom", description: "Define your own format" }
```

---

### Issue 3: "Find Ideas" Button UX

**Problem:** The AI "Find Ideas" button is clickable before a URL is entered, leading to confusing errors.

**Solution:** The button already has `disabled={isAnalyzing || !formData.substackUrl}` (line 897), which should work. However, we should add visual feedback to make it clearer why it's disabled.

**File:** `src/pages/PublicBooking.tsx`

Add a tooltip or visual cue when hovering over the disabled button:
- When disabled: Show muted styling with tooltip "Enter your newsletter URL first"
- Add a subtle prompt under the input field when empty

---

### Issue 4: Include AI Suggestion in Owner Notification

**Problem:** When a guest clicks "Use This" on an AI suggestion, the host/owner should be able to see which AI-generated idea was selected in their notification.

**Solution:** Include the selected AI suggestion details in the collab_request record and email notification.

**File:** `src/pages/PublicBooking.tsx`

1. Track when an AI suggestion is used:
   ```typescript
   const [selectedAiSuggestion, setSelectedAiSuggestion] = useState<CollabSuggestion | null>(null);
   ```

2. Update `handleUseSuggestion` to store the selection:
   ```typescript
   const handleUseSuggestion = (suggestion: CollabSuggestion) => {
     setSelectedAiSuggestion(suggestion);  // Store the selection
     // ... existing code
   };
   ```

3. Include in the insert payload:
   ```typescript
   .insert({
     // ... existing fields
     ai_suggestion_used: selectedAiSuggestion ? JSON.stringify({
       topic: selectedAiSuggestion.topic,
       format: selectedAiSuggestion.format,
       description: selectedAiSuggestion.description
     }) : null,
   })
   ```

**Database Change:** Add `ai_suggestion_used` column (JSONB, nullable) to `collab_requests` table.

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/pages/PublicBooking.tsx` | Update calendar headers, add clarification note, track AI suggestion selection, enhance button UX |
| `src/lib/validations.ts` | Update "Custom" metadata to remove dead "See guidelines" text |
| `src/pages/Settings.tsx` | Update "Custom" collab style description |
| Database | Add `ai_suggestion_used` JSONB column |

---

### Technical Notes

- All copy changes focus on emphasizing **publication/shipping dates** over meeting/scheduling language
- The "See guidelines" text is removed entirely since the feature isn't implemented
- AI suggestion tracking helps hosts understand what sparked the guest's interest
- Form validation already prevents submission without required fields; no additional changes needed for the "Failed to submit" error (likely a transient network issue)
