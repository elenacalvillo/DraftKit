import { z } from 'zod';
import { isValidSubstackUrl, isValidNewsletterPublicationUrl } from './substack-url';

export const emailSchema = z.string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

export const passwordSchema = z.string()
  .min(6, { message: "Password must be at least 6 characters" })
  .max(72, { message: "Password must be less than 72 characters" });

export const usernameSchema = z.string()
  .trim()
  .min(3, { message: "Username must be at least 3 characters" })
  .max(20, { message: "Username must be less than 20 characters" })
  .regex(/^[a-z0-9]+$/, { message: "Username can only contain lowercase letters and numbers" });

export const nameSchema = z.string()
  .trim()
  .min(1, { message: "Name is required" })
  .max(100, { message: "Name must be less than 100 characters" });

export const urlSchema = z.string()
  .trim()
  .url({ message: "Invalid URL format" })
  .max(500, { message: "URL must be less than 500 characters" });

// Substack URL - REQUIRED (for booking form) - accepts any valid Substack URL format
export const substackUrlRequiredSchema = z.string()
  .trim()
  .min(1, { message: "Newsletter URL is required" })
  .refine(
    isValidSubstackUrl,
    { message: "Enter your Substack URL (e.g., yourname.substack.com)" }
  );

// Newsletter PUBLICATION URL - required for content matching (rejects profile URLs)
// Use this when you need to fetch RSS/content - profile URLs won't work
export const newsletterPublicationUrlSchema = z.string()
  .trim()
  .min(1, { message: "Newsletter URL is required" })
  .refine(
    isValidNewsletterPublicationUrl,
    { message: "Enter your newsletter URL (e.g., yourname.substack.com). Profile URLs like substack.com/@name won't work." }
  );

// Substack URL - OPTIONAL (for settings/profile)
export const substackUrlOptionalSchema = z.string()
  .trim()
  .refine(
    (val) => val === '' || isValidSubstackUrl(val),
    { message: "Must be a valid Substack URL (e.g., yourname.substack.com)" }
  )
  .optional()
  .or(z.literal(''));

// Legacy alias for backwards compatibility
export const substackUrlSchema = substackUrlOptionalSchema;

// Newsletter URL - required for content matching (format: username.substack.com)
// Rejects profile URLs like substack.com/@name which don't have RSS feeds
export const newsletterUrlSchema = z.string()
  .trim()
  .min(1, { message: "Newsletter URL is required for SMART-powered content matching" })
  .refine(
    isValidNewsletterPublicationUrl,
    { message: "Enter your newsletter URL (e.g., yourname.substack.com). Profile URLs like substack.com/@name won't work." }
  );

export const messageSchema = z.string()
  .trim()
  .min(10, { message: "Please write a message (at least 10 characters)" })
  .max(1000, { message: "Message must be less than 1000 characters" });

export const bioSchema = z.string()
  .trim()
  .max(500, { message: "Bio must be less than 500 characters" })
  .optional();

export const welcomeMessageSchema = z.string()
  .trim()
  .max(500, { message: "Welcome message must be less than 500 characters" })
  .optional();

// Signup form schema
export const signupStep1Schema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupStep2Schema = z.object({
  name: nameSchema,
  username: usernameSchema,
  substackUrl: substackUrlSchema.optional().or(z.literal('')),
  newsletterUrl: newsletterUrlSchema,
  welcomeMessage: welcomeMessageSchema,
});

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Public booking form schema - uses STRICT newsletter validation (rejects profile URLs)
export const bookingFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  substackUrl: newsletterPublicationUrlSchema,
  message: messageSchema,
});

// Allowed collaboration styles (expanded with outcome-focused types)
export const ALLOWED_COLLAB_STYLES = [
  'Virtual Coffee',
  'Async Drafting', 
  'Interview Style',
  'Guest Post Exchange',
  'Live Event / Webinar',
  'Co-written Article',
  'Newsletter Shoutout',
  'Custom'
] as const;
export type CollabStyle = typeof ALLOWED_COLLAB_STYLES[number];

// Collaboration mode options (async-first vs discovery-first) — LEGACY, kept for one release
export const COLLAB_MODE_OPTIONS = ['async', 'discovery'] as const;
export type CollabMode = typeof COLLAB_MODE_OPTIONS[number];

// === NEW: Two-step Playbook (Vibe → Format) ===

// Step 1 — Vibe (the "How"): single-select
export const COLLAB_VIBE_OPTIONS = ['async', 'live', 'call'] as const;
export type CollabVibe = typeof COLLAB_VIBE_OPTIONS[number];

export const COLLAB_VIBE_METADATA: Record<CollabVibe, {
  label: string;
  description: string;
  icon: string;
  outcome: string;
  dateMeans: string;
  recommended?: boolean;
}> = {
  async: {
    label: 'Async Workspace',
    description: 'Write together inside the engine — no calls required.',
    icon: '✍️',
    outcome: 'A finished draft, written together',
    dateMeans: 'Target publish date',
    recommended: true,
  },
  live: {
    label: 'Substack Live',
    description: 'Record a Live conversation directly on Substack.',
    icon: '📺',
    outcome: 'A Substack Live recording',
    dateMeans: 'Live broadcast date',
  },
  call: {
    label: 'Video Call',
    description: 'A Zoom or Google Meet conversation.',
    icon: '☕',
    outcome: 'A live video conversation',
    dateMeans: 'Call date',
  },
};

// Step 2 — Format (the "What"): multi-select, async-only
export const COLLAB_FORMAT_OPTIONS = ['interview', 'cross-post', 'guest-post'] as const;
export type CollabFormat = typeof COLLAB_FORMAT_OPTIONS[number];

export const COLLAB_FORMAT_METADATA: Record<CollabFormat, {
  label: string;
  description: string;
  icon: string;
  outcome: string;
}> = {
  'interview': {
    label: 'Interview',
    description: 'Q&A style — one asks, one answers.',
    icon: '🎙️',
    outcome: 'A Q&A piece',
  },
  'cross-post': {
    label: 'Cross-post',
    description: 'A collaborative deep-dive on a shared topic.',
    icon: '🔁',
    outcome: 'One piece, both perspectives',
  },
  'guest-post': {
    label: 'Guest-post',
    description: 'One person leads the draft on the other\'s newsletter.',
    icon: '📝',
    outcome: 'A guest post',
  },
};

// Helper: parse collab_formats from DB (stored as JSON string array)
export const parseCollabFormats = (value: string | null | undefined): CollabFormat[] => {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f): f is CollabFormat => COLLAB_FORMAT_OPTIONS.includes(f as CollabFormat));
  } catch {
    return [];
  }
};

// Helper: get vibe from creator with safe fallback
export const getCreatorVibe = (vibe: string | null | undefined): CollabVibe => {
  if (vibe && COLLAB_VIBE_OPTIONS.includes(vibe as CollabVibe)) return vibe as CollabVibe;
  return 'async';
};

export const collabVibeSchema = z.enum(COLLAB_VIBE_OPTIONS);
export const collabFormatsSchema = z.array(z.enum(COLLAB_FORMAT_OPTIONS));

// Collaboration mode metadata for UI
export const COLLAB_MODE_METADATA: Record<CollabMode, {
  label: string;
  description: string;
  badge: string;
  badgeTooltip: string;
  calendarHeader: string;
  confirmationText: string;
  processSteps: { step: number; label: string }[];
  icon: string;
}> = {
  async: {
    label: 'Async Workspace',
    description: 'Skip the calls. Guests pick a topic, you start drafting. Calendar shows target publish dates.',
    badge: '100% Async',
    badgeTooltip: 'No meetings — you\'ll collaborate on a shared draft. Pick a target date to publish.',
    calendarHeader: 'When Should This Go Live?',
    confirmationText: 'Great! This is our target publish date. Check your email for next steps on drafting.',
    processSteps: [
      { step: 1, label: 'Your Idea' },
      { step: 2, label: 'Target Date' },
      { step: 3, label: 'Draft Review' },
    ],
    icon: '✍️',
  },
  discovery: {
    label: 'Discovery First',
    description: 'Meet collaborators on a call before committing. Calendar shows available call slots.',
    badge: "Let's Chat First",
    badgeTooltip: 'We\'ll have a quick call to discuss our collaboration',
    calendarHeader: 'Pick a Time for an Intro Call',
    confirmationText: 'Great! Check your email for a calendar invite to discuss your collaboration.',
    processSteps: [
      { step: 1, label: 'About You' },
      { step: 2, label: 'Schedule Call' },
      { step: 3, label: 'Decide Together' },
    ],
    icon: '☕',
  },
};

// Date meaning options for calendar (used as sub-option in async mode)
export const DATE_MEANING_OPTIONS = ['kickoff', 'publish', 'live', 'flexible'] as const;
export type DateMeaning = typeof DATE_MEANING_OPTIONS[number];

export const collabStylesSchema = z.array(
  z.enum(ALLOWED_COLLAB_STYLES)
).min(1, { message: "Select at least one collaboration style" });

export const dateMeaningSchema = z.enum(DATE_MEANING_OPTIONS);

export const collabGuidelinesSchema = z.string()
  .trim()
  .max(2000, { message: "Guidelines must be less than 2000 characters" })
  .optional()
  .or(z.literal(''));

export const reminderDaysSchema = z.number()
  .int()
  .min(1, { message: "Reminder must be at least 1 day before" })
  .max(14, { message: "Reminder must be at most 14 days before" });

export const collabModeSchema = z.enum(COLLAB_MODE_OPTIONS);

// Settings form schema
export const settingsSchema = z.object({
  name: nameSchema,
  bio: bioSchema,
  substackUrl: substackUrlSchema.optional().or(z.literal('')),
  newsletterUrl: newsletterUrlSchema,
  welcomeMessage: welcomeMessageSchema,
  collabStyles: collabStylesSchema,
  collabGuidelines: collabGuidelinesSchema,
  reminderDaysBefore: reminderDaysSchema,
  dateMeaning: dateMeaningSchema.optional(),
  collabMode: collabModeSchema.optional(),
});

// Collab type metadata for UI display
export const COLLAB_TYPE_METADATA: Record<CollabStyle, { outcome: string; dateMeans: string; icon: string }> = {
  'Virtual Coffee': { outcome: 'A live conversation', dateMeans: 'Live call date', icon: '☕' },
  'Async Drafting': { outcome: 'A finished article draft', dateMeans: 'Target publish date', icon: '✍️' },
  'Interview Style': { outcome: 'A Q&A exchange', dateMeans: 'Deadline for responses', icon: '🎙️' },
  'Guest Post Exchange': { outcome: 'A finished article draft', dateMeans: 'Drafting deadline', icon: '📝' },
  'Live Event / Webinar': { outcome: 'A scheduled meeting link', dateMeans: 'The actual live date', icon: '📺' },
  'Co-written Article': { outcome: 'A shared outline/draft', dateMeans: 'Kick-off brainstorm', icon: '🤝' },
  'Newsletter Shoutout': { outcome: 'A blurb or recommendation', dateMeans: 'Publish date', icon: '📣' },
  'Custom': { outcome: 'Custom arrangement', dateMeans: 'To be discussed', icon: '⚙️' },
};
