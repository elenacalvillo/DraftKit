

## Update Newsletter Matching Copy (Sam Filter Compliant)

Based on user feedback, people don't understand why they need to submit their newsletter URL. The current copy also violates the "Sam Filter" by mentioning "AI-powered". Here are the proposed changes:

---

### Changes Overview

| Element | Current | Proposed |
|---------|---------|----------|
| **Helper text** | "Your newsletter URL for AI-powered collaboration ideas..." | "Your newsletter URL for SMART-powered collaboration ideas..." |
| **Button label** | "Find Ideas" | "Match Our Content" |
| **Tooltip** | "Enter your newsletter URL first" | "We'll scan both newsletters to suggest topics that fit our overlap" |
| **Fallback message** | "AI matching unavailable..." | "Smart matching unavailable..." |

---

### Why These Changes

1. **"SMART-powered"** replaces "AI-powered" per your request - maintains the premium feel without the AI buzzword
2. **"Match Our Content"** makes it clear this is about comparing *both* newsletters - collaborative framing
3. **Tooltip now explains the value** - visitors understand *why* entering their URL unlocks this feature
4. **Consistent terminology** - all references use "smart" instead of "AI"

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/PublicBooking.tsx` | Update 4 text strings: helper text, button label, tooltip, fallback message |

---

### Implementation Details

**Line 974 - Button label:**
```tsx
<Sparkles className="w-4 h-4 mr-2" />
Match Our Content
```

**Lines 979-981 - Tooltip:**
```tsx
<div className="...">
  We'll scan both newsletters to suggest topics that fit our overlap
  <div className="..." />
</div>
```

**Line 991 - Helper text:**
```tsx
<p className="text-xs text-muted-foreground">
  Your newsletter URL for SMART-powered collaboration ideas (e.g., yourname.substack.com)
</p>
```

**Line 998 - Fallback message:**
```tsx
Smart matching unavailable — {creator.name} hasn't linked their newsletter yet
```

