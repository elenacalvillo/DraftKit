# Update DraftKit_Full_Specification.md to May 2026

The current spec is comprehensive but ~1 month stale. I'll rewrite it in-place at `/mnt/documents/DraftKit_Full_Specification.md` (and save a `_v2` copy) bumping the version header to **May 2026** and folding in every shipped change since the last revision. No source code is touched — this is a documentation-only update.

## What's missing / out of date

Cross-referenced against `mem://index.md` and the current codebase. Items the existing spec does not mention or describes incorrectly:

### Workspace editor
- **Inline image uploads** (toolbar button, drag-and-drop, paste) → `workspace-images` Supabase Storage bucket, client-side compression to ≤1 MB via `browser-image-compression`, public URLs (never base64), RLS via `(storage.foldername(name))[1]::uuid` + `has_workspace_access`, 25 MB raw cap, JPEG/PNG/GIF/WebP only
- **Tables** in Tiptap (extensions + DOMPurify whitelist) — currently only one-line mention
- **Sticky Highlights** — async inline annotations with tooltip logic
- **Long-form scaling** — architecture supports 5k–50k word drafts
- **Floating pill toolbar** active-formatting tracking specifics

### Book Projects (entirely missing from spec)
- `/dashboard/projects` and `/dashboard/projects/:id` routes
- `projects`, `project_members`, `project_chapters`, `project_broadcasts` tables
- `project-images` Storage bucket + `increment_storage_used` RPC + 1 GB per-creator cap (`creators.storage_used_bytes`)
- `project-broadcast` edge function
- Upgrade prompt + Pro gating

### Auth & access
- Guest account linking trigger (`link_requests_to_new_user`) for off-platform invites — covered briefly, needs the database-trigger detail
- Writer's Room: host-exclusive administrative authority (only host can remove/invite, 1:many guest capacity rules)
- Workspace access policy: permanent access after first credit spend (Host Gate)

### Monetization & subscription
- "No Dead Ends" routing on Manage Subscription button
- Stripe Checkout: VAT collection + currency retry fallback specifics
- Membership Hub (`/dashboard/subscription`) growth-engine rules and phrasing
- Founding Member vs standard subscription distinction (already partial)

### Discovery & growth
- 3-tier Substack ID resolution (Search API → RSS → direct URL) — mentioned, needs the "Discovery Resilience" framing
- Registered-creator priority sorting and search in Network
- Profile image fallback for missing/corrupted Substack CDN avatars
- Radial community network visualization on landing
- Agent-Led Growth: JSON-LD + hidden metadata for AI crawlers (partial)

### Communications & retention
- Weekly "Elena" release notes via filtered Conventional Commits
- Resend audience auto-sync for marketing
- Two-way platform messaging via `collaboration_messages` (already there, needs schema detail)
- Reschedule flow conflict-free logic
- Retrospective `/retro/:collabId` frictionless route (covered, needs current copy)

### UI / brand
- Action-First Navigation (Pending items as a to-do list on dashboards)
- Strategic terminology rename history (Requests→Collabs, Sent Requests→Proposals, AI→SMART, etc.) — covered, add note that this is a hard rule
- Footer 3-row centered stacking
- Accessibility & high-contrast styling system
- Contextual Request Card progressive disclosure
- Premium positioning / "ultra-bright watercolor" booking customization
- Zen mode layout constraints

### Database additions to schema section
- `projects`, `project_members`, `project_chapters`, `project_broadcasts`
- `creators.storage_used_bytes` column
- Storage buckets list: `workspace-images`, `project-images`
- `increment_storage_used` RPC
- New edge function: `project-broadcast`

### Security
- Multi-layered RLS with helper functions in `internal` schema notes
- Storage RLS for both buckets (folder-derived request_id / project_id)
- Per-account 1 GB storage cap enforcement
- Realtime policy hardening (auth.uid() participant check, not `USING true`)
- PII column-level protection (zombie policy cleanup)

### Test cases to add
- Workspace image upload (toolbar / drop / paste, free + Pro, RLS denial for non-participants)
- Book Projects CRUD + Pro gating
- Storage cap reached → friendly error
- Reschedule does not create conflict
- Founding member retains Pro after subscription cancel

## How the document will be restructured

- Bump version header to **May 2026**
- Keep the existing 15 top-level sections; insert subsections rather than reshuffle so the diff stays reviewable
- Add a new **§5.18 Book Projects** subsection
- Add a new **§5.19 Workspace Image Uploads** subsection
- Expand **§4 Database Schema** with new tables, columns, storage buckets, and the `increment_storage_used` RPC
- Expand **§6 Security Architecture** with storage RLS, realtime hardening, storage cap, and the "no zombie policies" rule
- Expand **§8 Edge Functions** with `project-broadcast`
- Add a short **Changelog since April 2026** appendix at the end so future updates have a running history

## Deliverables

1. `/mnt/documents/DraftKit_Full_Specification.md` — updated in place
2. `/mnt/documents/DraftKit_Full_Specification_v2.md` — versioned snapshot of the May 2026 revision so the April baseline remains comparable

No code, schema, or backend changes will be made.
