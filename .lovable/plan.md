

## Remove "AI" References - Apply Sam Filter Branding

Per the brand guidelines, we need to replace "AI" terminology with "SMART" across the application. The Sam Filter prioritizes "Professional Utility" over "AI-led automation".

---

### Locations to Update

| File | Line | Current Text | Proposed Text |
|------|------|--------------|---------------|
| `Settings.tsx` | 398 | "Required for AI collaboration suggestions" | "Required for SMART-powered content matching" |
| `Signup.tsx` | 599 | "Required for AI collaboration suggestions" | "Required for SMART-powered content matching" |
| `validations.ts` | 64 | "Newsletter URL is required for AI collaboration suggestions" | "Newsletter URL is required for SMART-powered content matching" |
| `PublicBooking.tsx` | 1083 | "AI Collaboration Ideas" | "SMART Match Ideas" |
| `Requests.tsx` | 161 | "create an AI collaboration outline" | "create a collaboration outline" |
| `CollabDraftModal.tsx` | 96 | "AI Collaboration Draft" | "SMART Draft Workspace" |
| `AdminAnalytics.tsx` | 486 | "AI Suggestions Used" | "SMART Suggestions Used" |

---

### Changes Overview

**7 files** need updates to replace AI terminology with Sam Filter-compliant alternatives:

1. **Settings.tsx** - Helper text under Newsletter URL field
2. **Signup.tsx** - Helper text during onboarding  
3. **validations.ts** - Zod validation error message
4. **PublicBooking.tsx** - Section header for match suggestions
5. **Requests.tsx** - Toast notification after approval
6. **CollabDraftModal.tsx** - Modal dialog title
7. **AdminAnalytics.tsx** - Analytics card title (admin-only, but for consistency)

---

### Terminology Map (Sam Filter)

| Old Term | New Term |
|----------|----------|
| "AI collaboration" | "SMART-powered" or "content matching" |
| "AI-powered" | "SMART-powered" |
| "AI suggestions" | "SMART suggestions" |
| "AI draft" | "SMART draft" |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Line 398: Update helper text |
| `src/pages/Signup.tsx` | Line 599: Update helper text |
| `src/lib/validations.ts` | Line 64: Update validation message |
| `src/pages/PublicBooking.tsx` | Line 1083: Update section header |
| `src/pages/Requests.tsx` | Line 161: Update toast description |
| `src/components/requests/CollabDraftModal.tsx` | Line 96: Update modal title |
| `src/pages/AdminAnalytics.tsx` | Line 486: Update card title |

