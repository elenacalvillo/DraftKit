# Karen's feedback: what's covered, what's still open

Status of each item in her document, based on the change history and the current code.

## Already shipped

| Item (date she raised it) | Shipped | How |
| --- | --- | --- |
| Invited writer can't get back to their chapter from Dashboard (07-03) | Aug 19 + Aug 24 | "Shared with me" list for invited collaborators, then the Collaborations hub listing every workspace a person can reach |
| Wrong sender names in Conversation ("Partner" on both sides) (07-03) | Sep 1 | Identity resolution and email fan-out fixed in the workspace |
| Collaborator shown as "Collabs" instead of the real name (07-03) | Sep 1 | Same fix; names now resolve from the linked account |
| Roles are unexplained, reviewers shouldn't edit (07-03) | Aug 19 + Aug 24 | Role definitions surfaced in invite menus and popovers; comment-only reviewer mode added |
| Rename the book project, add title/subtitle/author credits (07-04) | Aug 14 (metadata) + Aug 17 (rename) | Book details dialog with title, subtitle, author, ISBN, language, cover; rename in project settings |
| EPUB export with an embedded Kindle cover (07-04) | Aug 14 | Cover embedded in EPUB/PDF/DOCX exports, private cover storage |
| Long proposal text pushing the button off-screen (07-11) | Aug | Proposal cards wrap text and the whole row opens the workspace |
| Blessing's messages rejected by mail providers (07-16) | Sep 1 | Emails now send as "Name via DraftKit" from our own domain, so DMARC passes |
| Identical invitation emails, no workspace or book name (07-19) | Aug 24 | Emails carry the chapter/collaboration name and deep-link into Collaborations |
| Pasting from Google Docs broken / pasted as an image (07-16 onward) | Aug 24 | Paste now prefers real formatted text over the screenshot |
| "Failed to send invitation" when adding a writer (Farida) | Sep 3 | Missing contact emails backfilled, invite falls back to the account email, real error text shown |
| Needs Response should mean unread messages | Aug 24 | Unread tracking per workspace |
| Switching between chapters is tedious | Jul | Previous/next arrows, chapter picker and keyboard shortcuts in the workspace |
| Move chapters between projects | Aug 24 | Move-chapter dialog |
| Only 3 active projects allowed | Jul 25 | Cap removed for paid project accounts |

## Not covered yet (confirmed missing in today's code)

1. **Show the assigned writer's name in the chapter list** instead of the project owner's name.
2. **Word count for a selection**, plus her bigger ask: per-section counts, target ranges, and a CSV of chapter lengths.
3. **Search box over the collaboration list** — the Collaborations page has tabs and filters but no text search, and she has 50+ workspaces.
4. **Network search can't find people who haven't enabled collaborations** — search only looks at registered public profiles, while Substack recommendations show non-registered people with no working action. Also decide whether those tiles should appear at all, and drop the useless "copy invite link".
5. **Clickable collaborator names** in the Writer's Room, linking to their DraftKit profile.
6. **"Message Partner" is clickable in a solo document** with nobody to receive it.
7. **Invite dialog closes and sends too early**, before she can type the note; field order puts the optional note above the person search.
8. **Misaligned "Joined"/"Pending" badges** in the Writer's Room.
9. **Floating format bar covers the last line** when typing at the end of a long chapter.
10. **Enter key sometimes won't create a new line at the very end** of a document.
11. **Front/back matter and TOC ordering** for print-ready manuscripts, and a per-chapter "include in TOC" switch.

## Needs investigation before I promise a fix

- **Invited writers can't paste images** ("violates row security policy"). Owners can. Likely an image-storage permission scoped to the workspace owner only; I need to read the storage rules and reproduce as a guest before stating the cause.
- **Same due date can't be reused across chapters** (Sept 30 greyed out on the second chapter). Booking availability logic is shared with public bookings, so I need to confirm exactly which rule blocks it, then exempt project chapters and, separately, stop project deadlines from blocking outside guest bookings.
- **Chapters only appear in Recent Collabs after an edit**, and they show "Chapter 1" instead of the chapter name. Need to check what feeds that list.

## Suggested order of work

Round 1 (blockers for her book-3 run): guest image paste, shared due dates across chapters, writer name in the chapter list, collaboration search.
Round 2 (friction): invite dialog behaviour and field order, Message Partner in solo docs, badge alignment, Recent Collabs naming and inclusion, clickable collaborator names.
Round 3 (bigger builds): selection and per-section word counts with CSV export, front/back matter and TOC control, end-of-document typing behaviour.

Tell me which round to start on, or pick individual items and I'll plan those in detail.
