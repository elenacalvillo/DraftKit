# QA Pass: 5 Scenarios on Isolated Test Data

Goal: prove these flows work end to end without touching any real user or project. Everything runs on two throwaway accounts and one throwaway project, then gets removed.

## Test fixtures

- Create two auth users with confirmed emails and creator profiles: `test-owner@draftkit.app` (host/owner) and `test-guest@draftkit.app` (guest/collaborator).
- Create one project, `QA Sandbox <timestamp>`, owned by the test owner, with a few chapters, plus one classic collab whose pitch message is a 400+ character paragraph.
- Every inserted row is tagged by the test owner/guest ids and the sandbox project id so cleanup is a single scoped delete. No query in this pass touches rows outside those ids.
- Real user data: read-only at most. No deletes, no updates.

## Scenarios and pass criteria

1. Pre-acceptance pitch and chat
   - Guest sends a collab pitch with a long message.
   - Host review card shows the full pitch text in-app (no truncation that hides content, expandable if clamped).
   - Host replies before accepting; guest sees the message thread and can reply back.

2. Duplicate title guardrail
   - Create a solo draft, then attempt a chapter and a draft with the exact same title.
   - Inline warning appears naming the existing workspace, with an "Open existing" action.
   - "Open existing" routes to the right workspace; creating anyway still succeeds (soft warning, not a block).

3. Leave workspace (guest)
   - Owner invites the guest, guest joins, guest clicks "Leave workspace".
   - Workspace disappears from the guest's Collaborations list and the guest can no longer open it.
   - Owner still sees the workspace with manuscript content intact.

4. Permanent delete confirmation phrase
   - Short title ("Chapter 1"): dialog requires typing `Chapter 1`.
   - Classic collab whose title is a long pitch paragraph: dialog requires typing `DELETE`.
   - Wrong phrase keeps the confirm button disabled.

5. Resend invite state isolation
   - Project Members tab with three pending invites.
   - Clicking "Resend invite" on one row spins only that row; the other rows stay idle and clickable.

## How it runs

- Seeding and teardown via scoped SQL/service-side inserts, keyed on the two test user ids and the sandbox project id.
- UI verification with Playwright against the local dev server, logging in as each test account, screenshotting each pass criterion (pitch card, duplicate prompt, guest list before/after leave, both delete dialogs, the isolated spinner).
- Any failure gets fixed in code in the same pass, then the scenario is re-run.

## Cleanup

- Delete the sandbox project, its chapters, collabs, messages, revisions, members and reads, then the two test creator profiles and auth users.
- Verify with a post-teardown count that zero sandbox rows remain, and report anything that could not be removed.

## Reporting

For each of the 5 scenarios: pass/fail, evidence (screenshot or query result), and any code change made. Explicitly list anything I could not verify rather than marking it done.
