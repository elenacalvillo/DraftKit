
## Goal

Every collaboration-related email should:
1. Take the recipient **directly to the exact workspace** (`/dashboard/workspace/:requestId`) when a specific collab exists, so they never need to hunt for it.
2. Fall back to the new unified **`/dashboard/collaborations`** hub (Needs response / Active / Published / Archived) instead of the deprecated `/dashboard/my-requests` or `?open=requests` deep-links.

## Current state (audit)

All email HTML lives inside edge functions (no React Email templates for these). Base URL is `SITE_URL` env or `https://draftkit.app`.

### `send-collab-email` — 15 event types, one function, most CTAs go through `buildDashboardRequestLink()` which points to `/dashboard?open=requests&highlight=<id>` (legacy)

| Event `type` | Recipient | Current CTA | New CTA |
|---|---|---|---|
| `request_received` (line ~412) | Host | `https://collabstack.lovable.app/dashboard/my-requests` (hard-coded, wrong domain) | `${baseUrl}/dashboard/collaborations?tab=needs-response&highlight=<id>` + secondary "Open workspace" → `/dashboard/workspace/<id>` |
| `request_submitted` (line ~455) | Requester (confirmation) | `${baseUrl}` (home) | `${baseUrl}/dashboard/collaborations?tab=active&highlight=<id>` |
| `request_approved` (line ~500) | Requester | `buildDashboardRequestLink` (legacy) | `${baseUrl}/dashboard/workspace/<id>` (primary) |
| `request_declined` (line ~560) | Requester | `${baseUrl}/signup` | keep signup for ghost users; else `${baseUrl}/dashboard/collaborations?tab=archived&highlight=<id>` |
| `request_cancelled_by_guest` (line ~606) | Host | `buildDashboardRequestLink` | `${baseUrl}/dashboard/collaborations?tab=archived&highlight=<id>` |
| `collab_cancelled_by_host` (line ~648) | Requester | `${baseUrl}` | `${baseUrl}/dashboard/collaborations?tab=archived&highlight=<id>` |
| `new_message` (line ~732) | Host | `buildDashboardRequestLink` | `${baseUrl}/dashboard/workspace/<id>` (drops user straight into the conversation sidebar) |
| `new_message_from_guest` (line ~781) | Requester | `buildDashboardRequestLink` | `${baseUrl}/dashboard/workspace/<id>` |
| `collab_reminder` (line ~830) | Requester | `mailto:` only | add `${baseUrl}/dashboard/workspace/<id>` primary CTA |
| `collab_type_changed` (line ~908) | Requester | `mailto:` only | add `${baseUrl}/dashboard/workspace/<id>` |
| `collab_rescheduled` (line ~952) | Requester | `mailto:` only | add `${baseUrl}/dashboard/workspace/<id>` |
| `workspace_updated_by_creator` (line ~970) | Guest | already `/dashboard/workspace/<id>` ✅ | keep |
| `workspace_updated_by_guest` (line ~1009) | Creator | already `/dashboard/workspace/<id>` ✅ | keep |
| `collab_published` (line ~1056) | Both | already `/dashboard/workspace/<id>` ✅ | keep |
| `workspace_invite` (line ~1111) | Invited collaborator | already `/dashboard/workspace/<id>` ✅ | keep; also make sure signup redirect preserves `?next=/dashboard/workspace/<id>` (already allow-listed in `Login.tsx`) |

### Other email functions

| Function | Current CTA | New CTA |
|---|---|---|
| `send-collab-reminder` | (uses `send-collab-email` internally) | inherits fix above |
| `send-collab-retrospective` | `retroUrl` = `/retro/<id>` | keep (dedicated retro page), but add small secondary "Open workspace" link → `/dashboard/workspace/<id>` |
| `send-weekly-digest` | `https://draftkit.app/dashboard` | change to `${baseUrl}/dashboard/collaborations` (action-first landing) |
| `project-broadcast` | `/dashboard/projects/<projectId>` | keep (projects hub is correct) |
| `send-ghost-user-recovery` | `${APP_URL}/signup` | keep (pre-account) |
| `send-signup-fix-followup` | `${APP_URL}/signup` | keep (pre-account) |
| `send-feedback-notification` | admin-only, no CTA change | none |

## Implementation

1. **Add a single helper** in `send-collab-email/index.ts` replacing `buildDashboardRequestLink`:
   ```ts
   const workspaceUrl  = (id: string) => `${baseUrl}/dashboard/workspace/${encodeURIComponent(id)}`;
   const collabHubUrl  = (tab: "needs-response"|"active"|"published"|"archived", id?: string) =>
     `${baseUrl}/dashboard/collaborations?tab=${tab}${id ? `&highlight=${encodeURIComponent(id)}` : ""}`;
   ```
   Delete the legacy helper. Replace the hard-coded `collabstack.lovable.app` URL.

2. **Rewrite each CTA** per the table above (primary button = workspace when the collab is live; secondary link = Collaborations hub tab). For pre-signup recipients (`request_declined` to ghost users, `workspace_invite` to non-users) keep the signup redirect and append `?next=/dashboard/workspace/<id>` so they land in the right place after auth.

3. **`send-collab-retrospective`**: append a secondary "Open workspace" link under the star row using the same `${baseUrl}/dashboard/workspace/<id>` pattern.

4. **`send-weekly-digest`**: swap the single hero button to `${baseUrl}/dashboard/collaborations`.

5. **Confirm Collaborations hub reads `?tab=` and `?highlight=`**: `Collaborations.tsx` already accepts a tab param via the sidebar redirect. Add a small `useEffect` to select the tab from `?tab=` and scroll/focus the matching row from `?highlight=` (mirror the pattern already in `Requests.tsx` / `Dashboard.tsx`).

6. **Deploy** the four affected edge functions: `send-collab-email`, `send-collab-reminder` (no code change but ensures redeploy), `send-collab-retrospective`, `send-weekly-digest`.

## Out of scope

- Visual redesign of the email templates (still plain HTML strings; a future pass could migrate to React Email).
- `project-broadcast`, ghost recovery, signup follow-up, admin feedback — URLs stay as they are.
- Auth emails (`auth-email-hook`) — not part of the collab flow.

## Confirm before I build

- OK to also add the `?tab=` + `?highlight=` handler to `Collaborations.tsx` so the hub links land on the right tab and scroll to the row? (Needed for the fallback links to feel right; small ~15 lines.)
