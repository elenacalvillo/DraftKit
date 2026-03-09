
## Plan: Fix likes not appearing in Collab Impact

### Root Cause
In `fetchPostByUrl()` (line 220), when the API returns `reactions: {"❤":47}` (an object), the code sets:
```typescript
reaction_count: typeof reactions === "number" ? reactions : 0
```

This stores `0` because `reactions` is an object, not a number. Later, `getReactionCount()` checks `reaction_count` first and returns that `0` without ever summing the `reactions` object.

### Fix
**File:** `supabase/functions/fetch-collab-metrics/index.ts`

Change line 220 in `fetchPostByUrl()` to properly sum the reactions object when it's not a number:

```typescript
// Before:
reaction_count: typeof reactions === "number" ? reactions : 0,

// After:
reaction_count: typeof reactions === "number" 
  ? reactions 
  : (typeof reactions === "object" 
      ? Object.values(reactions).reduce((a: number, b) => a + (typeof b === "number" ? b : 0), 0) 
      : 0),
```

This ensures when the Substack API returns `{"❤":47}`, we sum all emoji values (47) and store that as `reaction_count`.

### Result
The API log shows `reactions={"❤":47}` but currently stores `creator_likes: 0`. After this fix, it will correctly store `creator_likes: 47`.
