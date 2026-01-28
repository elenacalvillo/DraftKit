

## Update Email Branding & Deep-Link to Specific Request

Based on your feedback, there are two key improvements needed:

1. **Brand Colors** - The emails currently use purple/violet colors (`#8b5cf6`, `#d946ef`) but DraftKit's brand identity is **cream & coral** (`hsl(8 65% 65%)` which is approximately `#d9826b` coral).

2. **Deep-Link to Specific Request** - The "View Request" button currently links to `/dashboard/requests` (the general list). It should open the specific request so you can take action immediately.

---

### Part 1: Brand Color Updates

**Current Purple Colors to Replace:**

| Current Color | Meaning | New DraftKit Color |
|---------------|---------|-------------------|
| `#8b5cf6` (purple) | Primary/Accent | `#d9826b` (coral - primary) |
| `#d946ef` (magenta) | Gradient end | `#c9946d` (warm accent) |
| `linear-gradient(135deg, #8b5cf6, #d946ef)` | Buttons/Icons | `linear-gradient(135deg, #d9826b, #c9946d)` |

**Color Mapping from CSS Variables:**
- Primary: `hsl(8 65% 65%)` = `#d9826b` (coral)
- Accent: `hsl(24 58% 60%)` = `#c9946d` (warm terracotta)
- Message box border: Use coral `#d9826b` instead of purple

---

### Part 2: Deep-Link Implementation

**Option A: URL Query Parameter (Recommended)**

Change email link from:
```
/dashboard/requests
```
To:
```
/dashboard/requests?highlight={requestId}
```

Then update the Requests page to:
1. Read the `highlight` query parameter on load
2. Scroll to that request card
3. Briefly highlight it (pulse animation or border glow)
4. Optionally auto-expand its details

This approach requires no route changes and works seamlessly.

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-collab-email/index.ts` | Replace all purple colors with coral brand colors; Update "View Request" URLs to include `?highlight={requestId}` |
| `src/pages/Requests.tsx` | Add logic to read `highlight` query param, scroll to that request, and apply highlight animation |

---

### Detailed Changes

#### Email Function (`send-collab-email/index.ts`)

**Color replacements across all templates:**
- Icon backgrounds: `linear-gradient(135deg, #8b5cf6, #d946ef)` → `linear-gradient(135deg, #d9826b, #c9946d)`
- Button backgrounds: Same gradient replacement
- Message border-left: `#8b5cf6` → `#d9826b`
- AI draft title color: `#8b5cf6` → `#d9826b`
- Highlighted text: `#8b5cf6` → `#d9826b`

**URL updates:**
- Line 399: `${baseUrl}/dashboard/requests` → `${baseUrl}/dashboard/requests?highlight=${requestId}`
- Line 447: Same pattern
- Line 579: Same pattern

#### Requests Page (`src/pages/Requests.tsx`)

Add highlight functionality:
1. Import `useSearchParams` from `react-router-dom`
2. Read `highlight` parameter on mount
3. Find the matching request card by ID
4. Scroll into view with smooth animation
5. Apply a brief coral glow/pulse effect
6. Clear the parameter from URL after a delay

```typescript
// Conceptual code
const [searchParams, setSearchParams] = useSearchParams();
const highlightId = searchParams.get('highlight');

useEffect(() => {
  if (highlightId && requests.length > 0) {
    const element = document.getElementById(`request-${highlightId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-pulse');
      setTimeout(() => {
        element.classList.remove('highlight-pulse');
        setSearchParams({}); // Clear the param
      }, 3000);
    }
  }
}, [highlightId, requests]);
```

---

### Visual Result

**Before (current email):**
- Purple gradient icon and buttons
- Purple accent borders
- Links to generic `/dashboard/requests`

**After (updated email):**
- Warm coral gradient matching DraftKit brand
- Coral accent borders
- Links to `/dashboard/requests?highlight={requestId}` which auto-scrolls and highlights the specific request card

