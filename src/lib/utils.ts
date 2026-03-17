import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a YYYY-MM-DD date string without timezone shifting.
 * Uses local time components to prevent UTC conversion issues.
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Strip corrupted Substack CDN signature tokens ($s_!...!) from image URLs.
 * These tokens get malformed during HTML scraping and break image loading.
 */
export function sanitizeSubstackImageUrl(url: string): string {
  if (!url) return url;
  return url.replace(/\$s_![^!]*!,?/, '');
}
