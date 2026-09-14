# Let guests mark a collab published, and unstick undated drafts

Your read is right, and confirmed in the code and database:

- The publish prompt only appears when the collab has a target date and that date has passed. A workspace saved as "Flexible — To be scheduled" has no date, so the prompt never appears at all.
- Marking published is host-only. In the sidebar the action is gated to the host, and the database rules physically block a guest or invited collaborator from flipping the status: their permission allows edits only while the collab stays "approved".
- Dismissing the prompt is stored in the browser, so it comes back on another device and is lost when someone clears their browser.

## What changes

**1. Guests and invited collaborators can mark it published**

Any confirmed participant in the workspace, not just the host, sees the "Mark as Published" action and can submit the post links. It sends the same notification and starts the same engagement tracking. The host's paid capacity check keeps applying to the host; a guest is never blocked by their own plan, since the host already paid for the workspace.

**2. Flexible drafts get a 14-day fallback**

- Target date set: nothing changes, today's behaviour stays.
- No target date: the prompt appears once the workspace is 14 days old, counting from when it was created.

**3. "Not publishing / ongoing workspace"**

The prompt gets a third answer next to Yes and Not yet. Choosing it hides the prompt for that workspace for everyone, permanently, stored on the collab itself rather than in one browser. Karen's feedback log stops nagging anybody. "Not yet" keeps its current meaning: the prompt returns later. "Mark as Published" stays available in the sidebar even after suppressing the prompt, so nothing becomes a dead end.

## Technical notes

- New security-definer function `mark_workspace_published(_request_id, _host_url, _guest_url)`: verifies the caller through `has_workspace_access`, writes `status = 'published'`, `collab_link`, `requester_collab_link`. Needed because the existing UPDATE policies and `enforce_collaborator_field_restrictions` deliberately freeze `status` and (for collaborators) the link columns. The function is the only sanctioned path; no policy is loosened, and hosts keep their current direct-update path.
- New security-definer function `set_publish_prompt_response(_request_id, _response)` writing a new nullable `collab_requests.publish_prompt_suppressed_at timestamptz`, callable by any participant via `has_workspace_access`.
- Migration adds the column plus both functions; no GRANT changes on new tables since none are created. `EXECUTE` granted to `authenticated`.
- `src/pages/Workspace.tsx`: widen `isRetroEligible` to `requested_date <= today` OR (`requested_date` null AND `created_at + 14 days <= now`); suppress when `publish_prompt_suppressed_at` is set; replace the host-only conditions on the sidebar publish buttons with a participant check (`isOwnerView || isGuest || isInvitedCollaborator`); route non-host submissions through the new RPC and keep the host's existing update path; keep the local dismissal as a soft "hide for now" and add the permanent option.
- Emails and `fetch-collab-metrics` calls stay unchanged and non-fatal.
- Solo workspaces with no other participant keep no publish action.
- Verify with Playwright as a guest on an undated workspace: prompt appears after 14 days of age, publishing succeeds, suppression persists across a reload.
