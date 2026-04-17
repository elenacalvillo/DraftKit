

## Plan: Public Read-Only Snapshot Links

### Architecture Principle
**Separate the Product (Writer's Room) from the Artifact (The Sheet).** The `/view/:token` route is a brand-new, isolated page that physically cannot leak workspace internals because it never imports them.

---

### 1. Database Migration

**Add to `collab_requests`:**
- `view_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()`
- Backfill existing rows happens automatically via the default.

**New RPC — `get_public_sheet(_token uuid)`:**
- `SECURITY DEFINER`, callable by `anon` + `authenticated`.
- Returns ONLY: `project_title` (derived from `selected_collab_type` or first heading), `shared_content`, `creator_name`, `creator_username`.
- Returns nothing else: no email, no notes, no AI draft, no chat, no collaborators, no metrics.
- Returns empty result if token doesn't match (page renders 404 state).

**No new INSERT/UPDATE policies.** Edit access remains gated solely by `workspace_collaborators` + ownership. The token literally cannot grant write access because no policy references it for writes.

---

### 2. New Isolated Page — `src/pages/PublicWorkspaceView.tsx`

Mounted at `/view/:token` (public, outside `ProtectedRoute`, outside `DashboardLayout`).

**Hard rules:**
- Imports ZERO workspace components (no `WorkspaceConversation`, no `WorkspaceCollaborators`, no `WorkspacePresence`, no toolbar, no sidebar).
- Tiptap editor with `editable: false` and only the **rendering** extensions (StarterKit, Link, Image, Table read-only). No comment/highlight extensions.
- Tailwind `prose prose-lg` centered layout — reads like a published article.
- Sets `<meta name="robots" content="noindex, nofollow">` via a small effect on mount.
- No OpenGraph tags for this route.

**Contextual sticky banner (uses `useAuth` only — does NOT load workspace data):**

| Viewer | Banner |
|---|---|
| Anonymous | "Built in a DraftKit Writer's Room. [Sign up free →]" |
| Logged in, NOT owner/collaborator | "You're viewing a shared draft. [Go to Dashboard]" |
| Owner OR invited collaborator | "You have edit access. [Enter Writer's Room →]" (links to `/dashboard/workspace/:id`) |

The owner/collaborator check runs a lightweight `has_workspace_access` lookup using the *real* request id returned by the RPC — only after auth is confirmed, so anon users skip it.

**404 state:** if RPC returns no row, show a clean "This draft is no longer available" page with a link to the landing page.

---

### 3. Routing — `src/App.tsx`

Add ONE line, before the `*` catch-all:
```tsx
<Route path="/view/:token" element={<PublicWorkspaceView />} />
```
Public, no `ProtectedRoute` wrapper, no layout wrapper.

---

### 4. Share UI — `src/components/requests/InviteCollaboratorModal.tsx`

Add a "Public view link" row at the very top of the modal body (above search/email modes, visible in both):

```text
┌────────────────────────────────────────┐
│ 👁  Public view link                    │
│ ┌────────────────────────────────┐ 📋  │
│ │ draftkit.app/view/abc-123...   │     │
│ └────────────────────────────────┘     │
│ Anyone with this link can view the     │
│ draft. Only invited writers can edit.  │
└────────────────────────────────────────┘
```

- Fetches `view_token` for the current `requestId` once on modal open (single SELECT).
- Click → `navigator.clipboard.writeText(...)` → toast "Link copied" + icon flips `Copy` → `Check` for 2s.

---

### 5. Security Coverage Summary

| Threat | Mitigation |
|---|---|
| Search engines indexing private drafts | `noindex, nofollow` meta tag |
| URL guessing | UUIDv4 token (122 bits entropy) |
| Public reader trying to edit | Editor `editable: false` + RLS rejects writes (no token-based write policy exists) |
| Scraper extracting PII | RPC whitelist returns only title + content + author display name |
| Workspace component data leak | Page imports zero workspace files — code path doesn't exist |
| Social preview cards leaking content | No OG tags on `/view` route |

---

### Files

| File | Change |
|---|---|
| SQL migration | Add `view_token` column + `get_public_sheet` RPC |
| `src/pages/PublicWorkspaceView.tsx` | NEW — isolated read-only sheet renderer |
| `src/App.tsx` | Register `/view/:token` route |
| `src/components/requests/InviteCollaboratorModal.tsx` | Add "Public view link" row + copy button |

### Out of Scope (future)
- Per-draft toggle to disable public link
- Token rotation / revocation UI
- OG preview cards (intentionally omitted)

