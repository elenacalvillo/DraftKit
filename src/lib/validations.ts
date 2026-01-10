import { z } from 'zod';

// Helper to validate Substack URL formats
function isValidSubstackUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  
  // Clean the URL for validation
  const cleanUrl = trimmed
    .replace(/^https?:\/\//, '')  // Remove protocol
    .replace(/\/+$/, '')           // Remove trailing slashes
    .replace(/\/.*$/, '');         // Remove any path
  
  // Pattern 1: username.substack.com
  if (/^[a-z0-9][a-z0-9-]*\.substack\.com$/i.test(cleanUrl)) {
    return true;
  }
  
  // Pattern 2: substack.com/@username (profile URL)
  const withPath = trimmed.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (/^substack\.com\/@[a-z0-9_-]+$/i.test(withPath)) {
    return true;
  }
  
  return false;
}

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

// Substack URL - REQUIRED (for booking form)
export const substackUrlRequiredSchema = z.string()
  .trim()
  .min(1, { message: "Newsletter URL is required" })
  .refine(
    isValidSubstackUrl,
    { message: "Enter your Substack URL (e.g., yourname.substack.com)" }
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

// Newsletter URL - required for AI analysis (format: username.substack.com)
export const newsletterUrlSchema = z.string()
  .trim()
  .min(1, { message: "Newsletter URL is required for AI collaboration suggestions" })
  .refine(
    isValidSubstackUrl,
    { message: "Enter your newsletter URL (e.g., yourname.substack.com)" }
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

// Public booking form schema
export const bookingFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  substackUrl: substackUrlRequiredSchema,
  message: messageSchema,
});

// Settings form schema
export const settingsSchema = z.object({
  name: nameSchema,
  bio: bioSchema,
  substackUrl: substackUrlSchema.optional().or(z.literal('')),
  newsletterUrl: newsletterUrlSchema,
  welcomeMessage: welcomeMessageSchema,
});
