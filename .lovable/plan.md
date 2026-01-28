
## Goals (what will change)
1) **Block Substack profile URLs from being submitted** in the public request form (only allow publication/newsletter URLs like `yourname.substack.com` or `open.substack.com/pub/...`).
2) **Make “Request Sent!” unambiguous**: explicitly state what the chosen date represents (publish deadline vs call time) and what the guest should expect next.
3) **Remove remaining user-facing “AI” wording everywhere** (UI + emails), replacing with “SMART” / “content matching” / plain-language equivalents.

---

## 1) Fix: newsletter publication URL validation on request submission (client + backend enforcement)

### 1.1 Client-side: use the strict schema for the booking form
**Problem found:** `bookingFormSchema` currently uses `substackUrlRequiredSchema` which accepts profile URLs. That’s why `substack.com/@...` still submits.

**Changes**
- **`src/lib/validations.ts`**
  - Update `bookingFormSchema.substackUrl` to use `newsletterPublicationUrlSchema` (the strict validator) instead of `substackUrlRequiredSchema`.
  - Also update **creator** newsletter validation so creators can’t save a profile URL in the “Newsletter URL” field:
    - Update `newsletterUrlSchema` to refine with `isValidNewsletterPublicationUrl` (or directly reuse `newsletterPublicationUrlSchema` inside `signupStep2Schema` and `settingsSchema`).

### 1.2 PublicBooking: validate again before insert + normalize
**`src/pages/PublicBooking.tsx`**
- In `handleSubmit`, add an explicit guard before inserting:
  - `newsletterPublicationUrlSchema.safeParse(formData.substackUrl)`
  - If invalid, set `errors.substackUrl` with the strict message and return.
- Normalize the requester newsletter URL before insert (canonical storage):
  - Use `normalizeSubstackUrl()` and store `normalizedResult.normalized` into `requester_substack_url`.
  - If normalization fails (shouldn’t after strict schema), show a friendly error.

### 1.3 Prefill bug: stop prefilling the guest field with profile URLs
Right now, logged-in creators prefill the guest “Your Newsletter URL” field using `authCreator.substack_url` (often a profile link), which will fail once we enforce strict validation.

**Fix**
- **`src/pages/PublicBooking.tsx`**
  - Prefill `formData.substackUrl` with `authCreator.newsletter_url` first, fallback to `authCreator.substack_url` only if it already looks like a publication URL (or don’t fallback at all).

### 1.4 Backend guardrail: enforce at database level (without breaking existing rows)
We already have existing requests in Test containing profile URLs:
- `collab_requests.requester_substack_url` has values like `https://substack.com/@...`

So we must enforce for **new inserts** without failing migration.

**Database migration**
- Add a **CHECK constraint with `NOT VALID`** so it applies to new rows but doesn’t retroactively reject existing rows:
  - `collab_requests.requester_substack_url` must **NOT** contain `substack.com/@`
- (Optional but recommended) Add a normal CHECK constraint for `creators.newsletter_url` since none violate it right now in Test.

Example approach (high-level):
- `ALTER TABLE public.collab_requests ADD CONSTRAINT ... CHECK (requester_substack_url IS NULL OR lower(requester_substack_url) NOT LIKE '%substack.com/@%') NOT VALID;`
- `ALTER TABLE public.creators ADD CONSTRAINT ... CHECK (newsletter_url IS NULL OR lower(newsletter_url) NOT LIKE '%substack.com/@%');`

**Why this matters:** even if a future UI regression happens, the backend will still block profile URLs from being stored.

### 1.5 UI helper text: be explicit
- **`src/pages/PublicBooking.tsx`** helper text under the field should say:
  - “Use a publication URL like `yourname.substack.com` (profile URLs like `substack.com/@name` won’t work).”
- Keep the separate “Substack Profile” concept for creators in Settings, but do not mix it into the booking submission field.

---

## 2) Fix: “Request Sent!” should explain date meaning + next steps (no ambiguity)

### 2.1 Make the date meaning explicit in the success copy
**Problem found:** success message only says “request for Wednesday…” and “They’ll be in touch soon.” It doesn’t state what that date is (publish deadline vs call time) or what the guest should expect.

**Changes**
- **`src/pages/PublicBooking.tsx`** success state UI:
  - Change the sentence to include a label:
    - Discovery mode: “intro call time”
    - Async mode: “target publish date” / “kickoff date” depending on `date_meaning` or selected collab type
  - Add a short “What happens next” section with 2–3 bullet points.

Suggested structure:
- Title: “Request sent”
- Subheadline: “Sent to {creator.name}”
- Date line:
  - If selectedDate: “Selected date: {formattedDate} — {meaning}”
  - If flexible: “Timing: Flexible — {what that means}”
- Next steps (mode-aware):
  - “You’ll receive a confirmation email with a copy of your request.”
  - “{creator.name} will reply by email with next steps (or decline).”
  - Discovery mode: “If accepted, you’ll receive a calendar invite for the call.”
  - Async mode: “If accepted, you’ll receive a message outlining next steps for drafting.”

### 2.2 Fix the CTA button spacing issue (“Create AccountMaybe Later”)
- Ensure the CTA button container always has visible separation and wraps cleanly:
  - Add `w-full` on mobile and keep `gap-3`
  - Ensure both buttons have consistent sizing (`w-full sm:w-auto`) so spacing is obvious.

### 2.3 Make calendar microcopy consistent
- **`src/components/calendar/CollabCalendar.tsx`**
  - Update the “No availability on this date…” toast to be mode-aware:
    - “No call slots on this date…” vs “No publication dates on this date…”

---

## 3) Add a guest confirmation email (so “what now” is concrete)

### 3.1 Extend the email function with a “request submitted” email
Currently, booking submission triggers only `request_received` (to the creator). The guest gets no receipt, which increases uncertainty.

**Changes**
- **`supabase/functions/send-collab-email/index.ts`** (backend function)
  - Add a new email type, e.g. `request_submitted` (service role)
  - Email goes to **requester_email** with:
    - creator name + selected date + what the date means
    - what happens next (mode-aware)
    - a “Reply to creator” or “Visit booking page” link

### 3.2 Trigger it after inserting the request
- **`src/pages/PublicBooking.tsx`**
  - After inserting the request, invoke `send-collab-email` twice:
    1) `request_received` (creator) — already exists
    2) `request_submitted` (requester) — new

### 3.3 Update existing creator email copy to clarify date meaning
- In the `request_received` email template, change:
  - “wants to collaborate with you on {date}”
  - to something like:
    - “requested {date} (target publish date)” or “(intro call time)”
- To do this, update the email function’s `select` to include creator `collab_mode` and `date_meaning`.

---

## 4) Remove remaining user-facing “AI” strings (UI + emails)

You asked for **no “AI” wording**. A quick scan shows multiple user-visible occurrences still.

### Files to update (examples we’ll address)
- **`src/pages/PublicBooking.tsx`**
  - Replace user-visible “AI analysis” error copy (e.g., “not enough posts yet for AI analysis”) with “SMART matching” / “content matching”.
  - Update section comments are fine, but any user-facing strings must be clean.
- **`src/components/requests/RequestCard.tsx`**
  - “AI Draft Ready” → “Draft Ready” or “SMART Draft Ready”
- **`src/components/landing/FeatureRoadmapSection.tsx`**
  - “AI Conversation Prep” → “Conversation Prep” or “SMART Conversation Prep”
- **`src/pages/Transparency.tsx`**
  - “AI Ethics & Content” section → rename to “Content Matching & Drafts” (and rewrite bullets without “AI”)
- **`src/pages/Signup.tsx`**
  - “No AI training on private drafts.” → “We never train on private drafts.”
- **`src/pages/AdminAnalytics.tsx`**
  - Rename visible funnel step labels like “AI Match Invoked” → “SMART Match Invoked”
- **`supabase/functions/send-collab-email/index.ts`**
  - “AI-Generated Collaboration Draft” → “Collaboration Draft” / “Draft Workspace”
- **`supabase/functions/analyze-collab-match/index.ts`**
  - Backend error “AI service not configured” → “Matching service not configured”

---

## Testing checklist (we’ll run through after implementation)
1) On public booking, try submitting:
   - `https://substack.com/@someone` → should be blocked with a clear error.
   - `yourname.substack.com` → should submit successfully.
   - `open.substack.com/pub/yourname?...` → should submit successfully.
2) Confirm the saved `requester_substack_url` is normalized (`https://xxx.substack.com`).
3) Verify success screen copy:
   - Includes what the date means (publish vs call) and next steps.
   - Buttons are spaced correctly on mobile/desktop.
4) Confirm guest receives a confirmation email (if email sending is enabled for your domain), and creator email also clarifies date meaning.
5) Search the UI for “AI” and confirm no user-facing occurrences remain (including landing + transparency + request cards).

---

## Implementation order (to minimize regressions)
1) Update schemas + PublicBooking submission validation + prefill fix
2) Add DB constraint (`NOT VALID`) to block new profile URLs
3) Update success UI copy + calendar toast microcopy
4) Add guest confirmation email type + trigger it
5) Sweep and replace remaining user-facing “AI” strings across UI + emails
