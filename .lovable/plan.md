

# Discovery Gap: Why Karen and New Creators Don't Appear

## The Problem

The Discovery page has **two separate data sources** that don't overlap:

1. **Substack Recommendations grid** — Only shows creators who appear in YOUR Substack recommendation list (fetched via Substack API). If Karen isn't someone you explicitly recommend on Substack, she will never appear here regardless of having a DraftKit account.

2. **Creator Search bar** — Queries `public_creator_profiles` by name/username, but ONLY when the user actively types a search query. It shows nothing by default.

So new DraftKit creators who aren't in your Substack recommendations are invisible unless you already know their name and search for them.

## Architecture Assessment: Should We Merge Tables?

No. The current table separation is correct and should stay:

- `creators` — Full profile with sensitive fields (Stripe IDs, subscription tier, user_id). Protected by owner-only + username-based RLS.
- `public_creator_profiles` — Security-invoker view that strips sensitive columns. This is the right pattern.
- `discovered_publications` — Substack metadata catalog (external data, not DraftKit users).
- `creator_recommendations` — Junction table mapping your recs to discovered pubs.

Merging would create security regressions. The real fix is a **UI/query gap**, not a schema problem.

## The Fix

Add a **"New on DraftKit" section** to Discovery that loads automatically (no search required) and shows all registered creators the current user hasn't collaborated with yet.

### Changes

**`src/pages/Discovery.tsx`**

1. Add a new query that fetches the latest creators from `public_creator_profiles` on page load (no search needed):
   - `SELECT id, name, username, profile_image_url, bio, created_at FROM public_creator_profiles WHERE username IS NOT NULL ORDER BY created_at DESC LIMIT 20`
   - Filter out the current user
   - Display as a grid section titled "New on DraftKit" between the search bar and the Substack Recommendations section
   - Each card shows avatar, name, username, and a "View Profile" button (same card component as search results)

2. Keep the existing search bar — it becomes a filter/discovery tool on top of the auto-loaded section.

3. Keep the Substack Recommendations section below — it shows cross-platform network data.

### Layout Order
```text
┌─────────────────────────────┐
│ Search bar                  │
├─────────────────────────────┤
│ Search results (if typing)  │
├─────────────────────────────┤
│ "New on DraftKit" grid      │  ← NEW: auto-loaded, no search needed
│ (latest 20 creators)        │
├─────────────────────────────┤
│ "Your Substack Recs" grid   │  ← existing
└─────────────────────────────┘
```

### No database changes needed
The `public_creator_profiles` view already has the data. We just need to query it on mount instead of only on search.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Discovery.tsx` | Add auto-loaded "New on DraftKit" section using `useQuery` on `public_creator_profiles` |

