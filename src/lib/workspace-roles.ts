/**
 * Workspace role helpers (DRAFT-005).
 *
 * The workspace has three user types:
 *   - Owner       — `creator.id === request.creator_id`
 *   - Guest       — `user.id === request.requester_user_id`
 *   - Collaborator — listed in workspace_collaborators (not the requester)
 *
 * Owner-only controls (Generate SMART Draft, Cancel Collab, Invite) must be
 * hidden from both Guests and Collaborators. We treat Collaborators the
 * same as Guests for UI purposes.
 */

export interface WorkspaceCollaboratorRef {
  user_id: string | null;
}

/**
 * `true` when the current viewer is a non-requester collaborator that has
 * been invited to the workspace via workspace_collaborators.
 *
 * Used to hide owner-only controls and to mirror the Guest experience.
 */
export function isInvitedCollaborator(
  userId: string | null | undefined,
  collaborators: ReadonlyArray<WorkspaceCollaboratorRef> | null | undefined,
): boolean {
  if (!userId || !collaborators || collaborators.length === 0) return false;
  return collaborators.some((c) => c.user_id === userId);
}

/**
 * Personalised "Message <first name>" label.
 *
 * - Guest view → other party's first name = the owner.
 * - Owner view → other party's first name = the guest.
 * - Solo / unknown → falls back to "Partner" so the label is never empty.
 */
export function getMessagePartnerLabel(name: string | null | undefined): string {
  if (!name) return "Message Partner";
  const first = name.trim().split(/\s+/)[0];
  return first ? `Message ${first}` : "Message Partner";
}
