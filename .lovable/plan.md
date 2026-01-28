

## Validate Newsletter Publication URLs (Not Profile URLs)

The current validation accepts profile URLs like `https://substack.com/@elenacalvillo`, but these don't work for the "Match Our Content" feature because:

1. A profile username is NOT the same as a newsletter subdomain
2. `@elenacalvillo` (profile) vs `productreleasenotes` (newsletter) are different
3. The RSS fetch fails because `elenacalvillo.substack.com/feed` doesn't exist

---

### The Problem

| URL Type | Example | Has RSS Feed? |
|----------|---------|---------------|
| Newsletter URL | `productreleasenotes.substack.com` | Yes |
| Profile URL | `substack.com/@elenacalvillo` | No (profile page only) |

The helper text says "yourname.substack.com" but accepts profile URLs - confusing!

---

### Solution

Create a **stricter validation** that only accepts **newsletter/publication URLs** (not profile URLs) for the booking form's substackUrl field.

---

### Changes Overview

| File | Change |
|------|--------|
| `src/lib/substack-url.ts` | Add new `isValidNewsletterUrl()` function that rejects profile URLs |
| `src/lib/validations.ts` | Create `newsletterPublicationUrlSchema` using the new validator |
| `src/pages/PublicBooking.tsx` | Update validation to use stricter schema + show clear error message |

---

### Implementation Details

**1. Add new validator function (substack-url.ts):**

```typescript
/**
 * Check if input is a valid newsletter publication URL (NOT a profile URL)
 * Profile URLs like substack.com/@username are rejected because they don't have RSS feeds
 */
export function isValidNewsletterPublicationUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  let url = input.trim();
  url = url.replace(/[?#].*$/, '');
  url = url.replace(/\/+$/, '');
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  
  // REJECT: substack.com/@username (Profile URLs don't have RSS feeds)
  const profileMatch = withoutProtocol.match(/^(?:www\.)?substack\.com\/@/i);
  if (profileMatch) {
    return false;
  }
  
  // ACCEPT: open.substack.com/pub/username (Mobile share - points to publication)
  const mobileMatch = withoutProtocol.match(/^open\.substack\.com\/pub\/([a-zA-Z0-9_-]+)/i);
  if (mobileMatch) return true;
  
  // ACCEPT: username.substack.com (Standard newsletter format)
  const standardMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]*)\.substack\.com(?:\/.*)?$/i);
  if (standardMatch) return true;
  
  // ACCEPT: Bare username (will be converted to username.substack.com)
  const bareUsernameMatch = withoutProtocol.match(/^([a-zA-Z0-9][a-zA-Z0-9_-]{1,49})$/);
  if (bareUsernameMatch && !withoutProtocol.includes('.') && !withoutProtocol.includes('/')) {
    return true;
  }
  
  return false;
}
```

**2. Add stricter schema (validations.ts):**

```typescript
import { isValidNewsletterPublicationUrl } from './substack-url';

// Newsletter PUBLICATION URL - required for content matching (rejects profile URLs)
export const newsletterPublicationUrlSchema = z.string()
  .trim()
  .min(1, { message: "Newsletter URL is required" })
  .refine(
    isValidNewsletterPublicationUrl,
    { message: "Enter your newsletter URL (e.g., yourname.substack.com). Profile URLs like substack.com/@name won't work." }
  );
```

**3. Update PublicBooking.tsx validation:**

Update the inline validation for the substackUrl field to use the new stricter schema and show a helpful error message when a profile URL is detected.

---

### Visual Before/After

**Before (accepts profile URL, fails silently on fetch):**
```
Your Newsletter URL *
[https://substack.com/@elenacalvillo] [Match Our Content]
                                        ↳ (Click fails with confusing error)
```

**After (rejects profile URL with clear message):**
```
Your Newsletter URL *
[https://substack.com/@elenacalvillo] [Match Our Content]
Enter your newsletter URL (e.g., yourname.substack.com). 
Profile URLs like substack.com/@name won't work.
```

---

### Why Profile URLs Don't Work

Profile pages (`substack.com/@username`) are user profiles, not newsletters:
- They show the user's bio, subscriptions, and activity
- They do NOT have an RSS feed (`/feed` endpoint)
- The username in the profile may be completely different from their newsletter subdomain

Example:
- **Profile**: `substack.com/@elenacalvillo` (Elena's profile page)
- **Newsletter**: `productreleasenotes.substack.com` (Elena's actual newsletter)

These are NOT interchangeable!

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/substack-url.ts` | Add `isValidNewsletterPublicationUrl()` function |
| `src/lib/validations.ts` | Add `newsletterPublicationUrlSchema` |
| `src/pages/PublicBooking.tsx` | Update validation logic to reject profile URLs with clear error |

