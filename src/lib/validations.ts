import { z } from 'zod';

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

export const substackUrlSchema = z.string()
  .trim()
  .url({ message: "Invalid URL format" })
  .refine(
    (url) => url.includes('substack.com') || url.includes('.substack.'),
    { message: "Must be a valid Substack URL" }
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
  substackUrl: substackUrlSchema,
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
  substackUrl: substackUrlSchema,
  message: messageSchema,
});

// Settings form schema
export const settingsSchema = z.object({
  name: nameSchema,
  bio: bioSchema,
  substackUrl: substackUrlSchema,
  welcomeMessage: welcomeMessageSchema,
});
