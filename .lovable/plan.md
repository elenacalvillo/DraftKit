# Clickable collaborator names and newsletter links in Collaborations

Dinah's request: when a collab request arrives, the sender's name should open their DraftKit page in a new tab, and their newsletter should be one click away, without leaving the Collaborations list.

## What changes on screen

On each collaboration card (Needs response, Active, Published, Archived):

- The person's name becomes a link that opens their DraftKit page in a new tab. Names without a DraftKit page stay plain text, exactly as today.
- Under the name, a small "Newsletter" link with an external-link icon opens their Substack (or other newsletter URL) in a new tab. Shown only when we have a URL.
- The avatar becomes clickable too, pointing to the same DraftKit page.
- Nothing else moves: badges, pitch box, and the Approve / Message / Decline buttons stay where they are.

```text
[avatar]  Dr. Isabel Perez Verona  [You host] [Pending]
          From Dr. Isabel Perez Verona
          Newsletter (opens in new tab)
          Created about 2 hours ago
```

Whose profile is shown: if you host, the requester's; if you pitched or were invited, the host's.

## Technical notes

1. Extend `list_my_workspaces()` (new migration, `CREATE OR REPLACE`, same signature plus columns) to also return:
   - `requester_username`, `requester_newsletter_url` — from a `LEFT JOIN public.creators` on `requester_user_id`, falling back to `collab_requests.requester_substack_url` when the requester has no account.
   - `host_newsletter_url` — `COALESCE(host.newsletter_url, host.substack_url)`.
   Keep the existing role-based masking rules: requester fields stay `NULL` for the `collaborator` role, as today.
2. Add the three fields to the `MyWorkspace` interface in `src/hooks/useMyWorkspaces.ts`.
3. In `src/components/...`/`src/pages/Collaborations.tsx` `WorkspaceRow`: derive `counterpartUsername` and `counterpartNewsletterUrl` from the role, wrap the title and avatar in an `<a target="_blank" rel="noopener noreferrer">` to `/{username}`, and render the newsletter link using the existing external-link helper in `src/lib/external-links.ts` so only valid public URLs render.
4. Only newsletter URLs that pass the existing publication-URL validation are rendered, so bad legacy values are skipped rather than shown as dead links.
