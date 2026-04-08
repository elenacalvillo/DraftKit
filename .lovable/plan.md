

# Strategic Terminology Rename: From "Requests" to "Collabs & Proposals"

## Overview

Rename all user-facing navigation and copy to shift from transactional language ("Requests") to collaborative language ("Collabs", "Proposals", "Network"). No backend or route changes — this is purely a front-end copy sweep.

## The Rename Map

| Old Term | New Term | Where |
|----------|----------|-------|
| Requests (sidebar) | Collabs | Sidebar nav |
| Sent Requests (sidebar) | Proposals | Sidebar nav |
| Discovery (sidebar) | Network | Sidebar nav |
| "Collaboration Requests" (page heading) | "Your Collabs" | Requests page |
| "Sent Requests" (page heading) | "Your Proposals" | MyRequests page |
| "No requests yet" | "No active collabs" | Empty states |
| "No sent requests yet" | "No proposals yet" | MyRequests empty state |
| "Request Collaboration" (button) | "Propose Collaboration" | PublicBooking page |
| "send a collaboration request" | "propose a collaboration" | PublicBooking flexible scheduling |
| "Action Required" / "Recent Requests" | "Action Required" / "Recent Collabs" | Dashboard section |
| "No requests yet" / "receiving requests" | "No collabs yet" / "receiving proposals" | Dashboard empty state |
| "Explore Discovery" (CTA) | "Explore Network" | Requests empty state |
| "Discover Creators" (CTA) | "Explore Network" | MyRequests empty state |
| "request page" | "collaboration page" | HowItWorksSection, Demo |
| "collaboration requests" | "collaborations" | PrivacyPolicy, Settings |
| "Collaboration Requests" (privacy title) | "Collaborations" | PrivacyPolicy |
| "Track collaboration requests you've sent" | "Track proposals you've sent to other creators" | MyRequests subtitle |
| "request collaborations with other creators" | "propose collaborations with other creators" | MyRequests empty body |
| "Needs Your Response" | Keep as-is | Already good |
| "Upcoming Collaborations" | Keep as-is | Already good |
| Status labels (Pending, Approved, etc.) | Keep as-is | Internal status, not "request" language |

## What NOT to Change

- **Route paths** (`/dashboard/requests`, `/dashboard/my-requests`, `/dashboard/discovery`) — changing URLs would break bookmarks, emails, and deep-links. Routes stay the same.
- **Database table/column names** — `collab_requests` stays. This is internal.
- **Variable names in code** — no refactoring of `requests`, `fetchRequests`, etc. This is cosmetic copy only.
- **Edge function email templates** — the `send-collab-email` function references are internal; email copy should say "collaboration" not "request" but that's a separate pass.
- **Status labels** (Pending, Approved, Declined, Cancelled, Published) — these are action states, not "request" language. They stay.

## Files Changed

| File | Change |
|------|--------|
| `src/components/layout/DashboardLayout.tsx` | Sidebar labels: "Collabs", "Proposals", "Network" |
| `src/pages/Requests.tsx` | Page heading, subheadings, empty state copy |
| `src/pages/MyRequests.tsx` | Page heading, subtitle, empty state copy, CTA label |
| `src/pages/Dashboard.tsx` | "Recent Collabs" fallback label, empty state copy |
| `src/pages/PublicBooking.tsx` | "Propose Collaboration" button, flexible scheduling text |
| `src/components/landing/HowItWorksSection.tsx` | "request page" → "collaboration page" |
| `src/pages/Demo.tsx` | "request page" → "collaboration page" |
| `src/pages/PrivacyPolicy.tsx` | "Collaboration Requests" → "Collaborations", update body copy |
| `src/pages/Signup.tsx` | "collaboration request" → "collaboration", "receiving collaboration requests" → "receiving collaborations" |
| `src/pages/Workspace.tsx` | "collaboration request" → "collaboration" in not-found message |
| `src/components/requests/RequestCard.tsx` | "This collaboration was cancelled." stays (already good). No changes needed. |

