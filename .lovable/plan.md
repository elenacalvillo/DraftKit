# Fix Discovery Ranking, Sent Requests Cleanup, and Creator Search

## Three Issues

### 1. Registered Users Missing from Discovery (Karen Smiley bug)

**Root cause**: The edge function (`fetch-substack-recommendations`) matches recommendations to DraftKit creators only by `substack_url` subdomain. If a creator registered with a `newsletter_url` (custom domain) or a slightly different URL format, the match fails silently. Karen has an account but her subdomain doesn't match any recommendation entry.

**Fix — Edge Function** (`supabase/functions/fetch-substack-recommendations/index.ts`):

- Also index creators by `newsletter_url` in the `creatorBySubdomain` map (extract hostname for custom domains)
- After building the recommendations list, sort results so `isOnDraftKit: true` entries come first (pinned to top)

**Fix — Frontend** (`src/pages/Discovery.tsx`):

- Sort the returned recommendations client-side as well: `isOnDraftKit` entries first
- Add a "Registered on DraftKit" section separator or just pin them to the top of the grid

### 2. Creator Search from Discovery

`**src/pages/Discovery.tsx**`:

- Add a search input above the grid that queries `public_creator_profiles` by name (case-insensitive `ilike`)
- Show search results as a separate section ("All DraftKit Creators") above the Substack recommendations
- Each result shows avatar, name, username, and a "View Profile" button linking to `/{username}`
- Search is debounced (300ms), minimum 2 characters

### 3. Hide Declined Requests in Sent Requests

`**src/pages/MyRequests.tsx**`:

- Add a `showAll` toggle state (default `false`)
- Filter `requests` to exclude `status === 'declined'` and `status === 'cancelled'` when `showAll` is false
- Add a small "Show All" / "Hide Declined" toggle button near the page header
- Declined requests already have a dismiss (hide) button but the user shouldn't need to manually trash each one

### 4. Name Truncation Fix in Sent Requests

`**src/pages/MyRequests.tsx**`:

- The `CardTitle` uses default styling which may truncate on narrow cards
- Remove any `truncate` class if present, or ensure the name area has `break-words` and no max-width constraint
- The `text-lg` on `CardTitle` is fine; the issue is likely the flex layout compressing the name div when the badge takes space — give the name container `min-w-0` and ensure the title can wrap
- Also, the emails are not being treated correctly in this screen, they are visible and we agreed to not make it visible in the front end, they should be treated as the other pages to address privacy and security.

## Files Changed


| File                                                         | Change                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `supabase/functions/fetch-substack-recommendations/index.ts` | Also match by `newsletter_url`, sort `isOnDraftKit` first                                       |
| `src/pages/Discovery.tsx`                                    | Add creator search input querying `public_creator_profiles`, sort results with registered first |
| `src/pages/MyRequests.tsx`                                   | Add show/hide toggle for declined+cancelled, fix name truncation                                |
