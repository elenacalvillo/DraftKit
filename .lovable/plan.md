

# Discovery Feature: Recommendation Loop & Smart Matching

## What We're Building

A new **Discovery** page (`/dashboard/discovery`) where creators see publications recommended by their own Substack network, with the ability to invite them to collaborate — even if they're not on DraftKit yet. This creates a natural growth loop: every invite is a "Trojan Horse" that pulls new users into the platform.

## Architecture

```text
User connects Substack URL (already stored in creators.substack_url)
        │
        ▼
Edge Function: fetch-substack-recommendations
  → GET https://{subdomain}.substack.com/api/v1/recommendations
  → Returns JSON list of recommended publications
  → Upsert into discovered_publications table
  → Flag any that are already DraftKit users
        │
        ▼
Discovery Page UI
  → "Writers You Recommend" cards
  → "Already on DraftKit" badge for existing users
  → "Invite to Collab" button for non-users
        │
        ▼
Invite Flow
  → For existing DraftKit users: link to their public booking page
  → For non-users: copy a shareable invite link to the creator's booking page
```

## Database Changes

### New table: `discovered_publications`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| subdomain | text (unique) | e.g. "promptledproduct" |
| name | text | Publication name |
| author_name | text | Author display name |
| description | text | Publication tagline/bio |
| logo_url | text | Publication logo |
| subscriber_count | integer | If available from API |
| language | text | If available |
| discovered_at | timestamptz | Default now() |

### New table: `creator_recommendations`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| creator_id | uuid | FK-like reference to creators.id |
| publication_id | uuid | FK to discovered_publications.id |
| fetched_at | timestamptz | When we last fetched this link |
| unique(creator_id, publication_id) | | Prevent duplicates |

RLS policies:
- Creators can SELECT their own recommendations (via `creator_id` matching `auth.uid()` through creators table)
- No public INSERT/UPDATE/DELETE (only the edge function writes via service role)

### Why two tables?
The `discovered_publications` table is a shared catalog — if Karen and Patricia both recommend "The AI Digest," it's stored once. The `creator_recommendations` table tracks who recommended whom, enabling the "Writers you recommend" and future "Creators your friends recommend" features.

## Edge Function: `fetch-substack-recommendations`

- Input: `{ creatorId: string }` (authenticated)
- Fetches the creator's `substack_url` from DB
- Calls `https://{subdomain}.substack.com/api/v1/recommendations`
- Parses the JSON response (array of publication objects with name, subdomain, description, etc.)
- Upserts each publication into `discovered_publications`
- Links them to the creator in `creator_recommendations`
- Cross-references subdomains against existing `creators.substack_url` to flag "Already on DraftKit"
- Returns the list with an `isOnDraftKit` flag and optional `bookingUrl`

Config: `verify_jwt = false` (validate auth in code, consistent with other functions).

## UI: Discovery Page

### New route: `/dashboard/discovery`
Add to `navItems` in `DashboardLayout.tsx` with a `Compass` or `Search` icon.

### Page layout:
1. **Header**: "Discover Collaborators" with a subtitle explaining the feature
2. **Fetch trigger**: On first visit (or if no data cached), call the edge function to sync recommendations. Show loading state.
3. **Publication cards** (grid layout, similar to request cards):
   - Publication logo/image
   - Name + author
   - Description/tagline
   - Subscriber count (if available)
   - Badge: "On DraftKit" (green) or "Not yet on DraftKit"
   - Action button:
     - If on DraftKit → "View Profile" (links to `/:username`)
     - If not → "Copy Invite Link" (copies the current user's booking page URL with a UTM or ref param)
4. **Empty state**: If the user has no `substack_url` set, prompt them to add one in Settings.

### Refresh: A "Refresh" button to re-fetch recommendations (rate-limited to once per hour client-side).

## Files to Create/Modify

| File | Action |
|---|---|
| Migration SQL | Create `discovered_publications` + `creator_recommendations` tables with RLS |
| `supabase/functions/fetch-substack-recommendations/index.ts` | New edge function |
| `supabase/config.toml` | Add function config |
| `src/pages/Discovery.tsx` | New page |
| `src/App.tsx` | Add route `/dashboard/discovery` |
| `src/components/layout/DashboardLayout.tsx` | Add nav item |

## What This Does NOT Include (Future Phases)

- Guest/invite token workspace access (Phase B from the Gemini conversation) — complex, separate effort
- "Creators your friends recommend" cross-referencing — needs more users first
- Substack search API integration — can layer on later
- Compatibility scoring between recommendations — future enhancement

## Risk & Cost

- **Cost**: Zero. The Substack recommendations API is a public JSON endpoint.
- **Risk**: Low. The API could change, but it's the same API their web app uses. We handle errors gracefully and show cached data.
- **Rate limiting**: We only fetch when a user visits Discovery, and cache results in our DB. Minimal API calls.

