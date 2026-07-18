/**
 * Centralized subscription tier / access utilities.
 *
 * Tier hierarchy:
 *   free  → no paid features
 *   pro   → all newsletter Pro features
 *   project → SUPERSET of pro: pro features + Book Project features
 *
 * All tier checks in the app should go through these helpers so the
 * tier hierarchy can be evolved in a single place.
 */

export type SubscriptionTier = "free" | "pro" | "project";

export const ACTIVE_PROJECT_LIMIT = 3;
export const STORAGE_CAP_BYTES = 1_073_741_824; // 1 GB
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ACTIVE_PROJECT_LIMIT_MESSAGE =
  "You have 3 active projects. Archive one to create a new project, or upgrade for unlimited projects.";

export const STORAGE_CAP_REACHED_MESSAGE =
  "You've reached your 1GB storage limit. Delete unused images to free up space.";

interface TierLike {
  subscription_tier?: string | null;
  trial_ends_at?: string | null;
}

/**
 * Normalize a free-form subscription_tier string into the allowed
 * union. Anything unrecognized falls back to 'free'.
 */
export function normalizeTier(tier: string | null | undefined): SubscriptionTier {
  if (tier === "pro" || tier === "project") return tier;
  return "free";
}

/**
 * True for any tier that should pass an existing Pro feature gate.
 * The Project tier is a superset of Pro — it must always pass.
 */
export function hasProAccess(creator: TierLike | null | undefined): boolean {
  if (!creator) return false;
  const tier = normalizeTier(creator.subscription_tier);
  if (tier === "pro" || tier === "project") {
    // Trial users with elapsed trial_ends_at are downgraded.
    if (creator.trial_ends_at && new Date(creator.trial_ends_at) <= new Date()) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * True only when the creator has the Project tier subscription
 * active. Used to gate Book Project features (image upload,
 * project creation, broadcast composition).
 */
export function hasProjectAccess(creator: TierLike | null | undefined): boolean {
  if (!creator) return false;
  const tier = normalizeTier(creator.subscription_tier);
  if (tier !== "project") return false;
  if (creator.trial_ends_at && new Date(creator.trial_ends_at) <= new Date()) {
    return false;
  }
  return true;
}

/**
 * Returns true if the creator has at least one project slot left.
 * A creator who has not yet hit ACTIVE_PROJECT_LIMIT may create a
 * new project. This matches the DB-level safety net.
 */
export function canCreateAnotherProject(activeCount: number): boolean {
  return activeCount < ACTIVE_PROJECT_LIMIT;
}

/**
 * Returns true if uploading the given file size would still leave
 * the creator under their 1GB pooled storage cap.
 */
export function canUploadImage(usedBytes: number, fileBytes: number): boolean {
  return usedBytes + fileBytes <= STORAGE_CAP_BYTES;
}

/**
 * Validate an image file's mime type is in the accepted set.
 */
export function isAcceptedImageMime(mime: string): boolean {
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Format a byte count as a human-readable storage usage string,
 * e.g. "32 MB of 1GB used".
 */
export function formatStorageUsage(usedBytes: number): string {
  const mb = usedBytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB of 1GB used`;
  }
  return `${mb.toFixed(1)} MB of 1GB used`;
}

/** Chapter editorial workflow stages (project workspaces only).
 *  Stored in collab_requests.chapter_stage. The collab_requests.status
 *  field is unrelated and tracks the row's collaboration lifecycle. */
export const CHAPTER_STAGES = [
  "draft",
  "peer_review",
  "editorial",
  "final",
] as const;
export type ChapterStage = (typeof CHAPTER_STAGES)[number];

export const CHAPTER_STAGE_LABEL: Record<ChapterStage, string> = {
  draft: "Draft",
  peer_review: "Peer Review",
  editorial: "Editorial",
  final: "Final",
};

/** Allowed forward + backward chapter transitions, controlled by admin. */
export function isValidChapterStageTransition(
  from: ChapterStage,
  to: ChapterStage,
): boolean {
  if (from === to) return false;
  return CHAPTER_STAGES.includes(from) && CHAPTER_STAGES.includes(to);
}

/** Project member roles. Strings must match the DB CHECK constraint. */
export const PROJECT_MEMBER_ROLES = [
  "admin",
  "chapter_writer",
  "peer_reviewer",
  "cross_chapter_reviewer",
] as const;
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

/** Human-readable label for a member role. */
export function roleLabel(role: ProjectMemberRole | string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "chapter_writer":
      return "Chapter Writer";
    case "peer_reviewer":
      return "Peer Reviewer";
    case "cross_chapter_reviewer":
      return "Cross-chapter Reviewer";
    default:
      return role;
  }
}

/** One-line description of what each project role can actually do.
 *  Source of truth: project_member_role + project_member_can_access_chapter
 *  in the book_projects_rls migration. */
export const PROJECT_MEMBER_ROLE_DESCRIPTIONS: Record<ProjectMemberRole, string> = {
  admin:
    "Full project control: rename, manage members, create or delete chapters, and edit every chapter.",
  chapter_writer:
    "Can open and edit only the chapters they've been assigned to. Other chapters stay hidden.",
  peer_reviewer:
    "Can review and edit only the specific chapters they've been assigned to. Other chapters stay hidden.",
  cross_chapter_reviewer:
    "Can open and edit every chapter in the project, but can't manage members or settings.",
};

/** Who each role is a fit for — used as helper copy in the role picker. */
export const PROJECT_MEMBER_ROLE_BEST_FOR: Record<ProjectMemberRole, string> = {
  admin: "A co-author or managing editor running the project with you.",
  chapter_writer: "A contributor writing one specific chapter.",
  peer_reviewer: "A beta reader giving feedback on one chapter.",
  cross_chapter_reviewer: "A developmental editor who needs to see the whole manuscript.",
};

/** Short suffix shown next to a member's role on their row. */
export function roleAccessSummary(role: ProjectMemberRole | string): string {
  switch (role) {
    case "admin":
      return "full project control";
    case "chapter_writer":
      return "edits assigned chapters only";
    case "peer_reviewer":
      return "reviews assigned chapters only";
    case "cross_chapter_reviewer":
      return "edits every chapter";
    default:
      return "";
  }
}

/** Longer definition for tooltips / reference popovers. */
export function roleDescription(role: ProjectMemberRole | string): string {
  if (role in PROJECT_MEMBER_ROLE_DESCRIPTIONS) {
    return PROJECT_MEMBER_ROLE_DESCRIPTIONS[role as ProjectMemberRole];
  }
  return "";
}

/** True when the given project role is restricted to leaving comments
 *  and cannot modify the underlying prose. Kept in one place so the
 *  editor, header badge, and backend guard cannot drift. */
export function isCommentOnlyRole(
  role: ProjectMemberRole | string | null | undefined,
): boolean {
  return role === "peer_reviewer" || role === "cross_chapter_reviewer";
}
