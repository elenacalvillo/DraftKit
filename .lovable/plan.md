## What is happening

Blessing is not seeing Karen's chapter because book project chapter invitations live in `workspace_collaborators`, while the normal Collabs page only lists classic incoming collab rows. The app already added a small `Shared with me` area under Proposals, but that is easy to miss and likely not where Blessing is looking. There is also a risk that a logged-in invited user without a creator profile gets pushed through signup/profile completion instead of landing on the workspace list.

## Plan

1. **Make invited chapter workspaces visible where users expect them**
   - Add invited `workspace_collaborators` rows to the Collabs experience for non-host collaborators.
   - Show book chapter workspaces as normal actionable cards, with a clear `Project` or `Chapter` badge and an `Open Workspace` button.
   - Keep host-owned project chapters out of the classic Collabs list so Karen's host view stays clean.

2. **Keep the Proposals fallback, but make it clearer**
   - Keep `Shared with me`, since it already helps collaborator-only users.
   - Improve the label/copy so it reads as invited workspaces, not sent proposals.
   - Ensure project chapter rows show the host/project context and direct workspace link.

3. **Fix auth routing for invited collaborators**
   - Allow `/dashboard/requests`, `/dashboard/my-requests`, and `/dashboard/workspace/:id` to be valid post-login destinations for invited collaborators who may not have a creator profile.
   - Prevent the app from forcing them into creator onboarding when they are just trying to access an invited chapter.

4. **Use backend access safely**
   - Do not broaden public access.
   - Fetch only the collaborator's own invitation rows and workspace rows they already have access to.
   - Preserve the existing workspace access helper as the source of truth.

5. **Validate the flow**
   - Check the logged-in collaborator route behavior.
   - Confirm an invited project chapter appears from the Collabs page and opens the correct workspace.

## Technical notes

- Likely files: `src/pages/Requests.tsx`, `src/pages/MyRequests.tsx`, `src/pages/Login.tsx`, possibly `src/components/requests/RequestCard.tsx` if the card cannot represent invited workspace rows cleanly.
- Backend migration is only needed if the current row-level rules block a collaborator from reading the minimal workspace metadata needed for their own invitation list. If needed, it will stay narrow and authenticated only.