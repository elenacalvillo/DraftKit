

## Pre-Launch Audit: What's Still Missing

Based on my thorough review of the codebase against the approved plan, here's the status of each item:

---

## Completed Items

| Item | Status |
|------|--------|
| Client-side URL validation (strict `newsletterPublicationUrlSchema`) | Done |
| URL normalization before insert | Done |
| Prefill bug fix (prefer `newsletter_url` over `substack_url`) | Done |
| Success screen shows date meaning | Done |
| Success screen shows "What happens next" | Done |
| Button spacing fix (`w-full sm:w-auto`) | Done |
| "My collaboration process" headline | Done |
| Async mode step labels ("Ship Date", "Drafting") | Done |
| RequestCard: "Draft Ready" (removed "AI") | Done |
| FeatureRoadmapSection: "SMART Match Ideas" | Done |
| Transparency page: "Content Matching & Drafts" section | Done |
| Signup page: "We never train on private drafts" | Done |
| AdminAnalytics: "SMART Match Invoked" label | Done |
| Email templates: "Collaboration Draft" / "Draft Workspace" | Done |
| Edge function error: "Matching service not configured" | Done |
| Email button brand color fix (`request_declined`) | Done |

---

## Missing Items (Still Need Implementation)

### 1. Database CHECK Constraint - Profile URL Blocking
**Status:** NOT DONE

The plan called for a `NOT VALID` CHECK constraint to prevent new rows from containing profile URLs (`substack.com/@...`) in `collab_requests.requester_substack_url`.

Current constraints on `collab_requests`:
- Only `collab_requests_status_check` exists

**Why it matters:** Even if a future UI regression happens, the backend would still block profile URLs from being stored.

**Fix needed:**
```sql
ALTER TABLE public.collab_requests 
ADD CONSTRAINT collab_requests_requester_url_no_profile 
CHECK (requester_substack_url IS NULL OR lower(requester_substack_url) NOT LIKE '%substack.com/@%') 
NOT VALID;
```

---

### 2. Guest Confirmation Email (`request_submitted`)
**Status:** NOT DONE

The plan called for a new email type `request_submitted` to send a receipt to the **guest** after booking. Currently, only the **host** receives `request_received`.

**Why it matters:** Guests currently have no email confirmation after submitting. This increases anxiety about "what now?"

**Fix needed:**
- Add `request_submitted` email type to `send-collab-email/index.ts`
- Trigger it in `PublicBooking.tsx` after inserting the request

---

### 3. Remaining User-Facing "AI" Text
**Status:** PARTIALLY DONE - 3 instances remain

| Location | Current Text | Should Be |
|----------|--------------|-----------|
| `TestimonialsSection.tsx` line 21 | "The AI-generated ideas..." | "The SMART-generated ideas..." or "The content-matched ideas..." |
| `HowItWorksSection.tsx` line 19 | "Get AI-curated talking points..." | "Get SMART-curated talking points..." or "Get curated talking points..." |
| `AdminAnalytics.tsx` line 168 | "% of bookings that used AI-suggested topics" | "% of bookings that used SMART-suggested topics" (internal metric, lower priority) |

---

### 4. Calendar Microcopy (Mode-Aware Toast)
**Status:** NOT VERIFIED

The plan mentioned updating the "No availability on this date…" toast to be mode-aware:
- Discovery mode: "No call slots on this date…"
- Async mode: "No publication dates on this date…"

This may have been skipped. Needs verification.

---

## Summary: What To Do Before Launch

| Priority | Item | Effort |
|----------|------|--------|
| High | Add database CHECK constraint (backend safety net) | 1 migration |
| High | Add guest confirmation email (`request_submitted`) | Medium - new email template + trigger |
| Medium | Fix remaining 2-3 "AI" strings in landing/testimonials | Quick text changes |
| Low | Verify calendar toast microcopy | Quick check |

---

## Recommendation

For a solid launch, I recommend:
1. **Add the database constraint** - This is a one-line migration that protects against future UI bugs
2. **Add the guest email** - Reduces guest anxiety significantly
3. **Fix the 2-3 remaining "AI" strings** - Quick wins for brand consistency

The calendar toast is lower priority and could be post-launch polish.

