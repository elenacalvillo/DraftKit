

## Fix: Update request_declined Email Button to Brand Coral

The `request_declined` email template is the only email that still uses the old dark button color (`#475569`) instead of the brand coral gradient.

---

### The Problem

**File:** `supabase/functions/send-collab-email/index.ts`
**Lines:** 357-359

**Current (wrong):**
```html
<a href="${baseUrl}" 
   style="display: inline-block; background: #475569; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
  Discover More Creators
</a>
```

**Should be (correct coral gradient):**
```html
<a href="${baseUrl}" 
   style="display: inline-block; background: linear-gradient(135deg, #d9826b, #c9946d); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
  Discover More Creators
</a>
```

---

### Why This Happened

When the brand colors were updated previously, 7 of 8 email button instances were correctly changed to use `linear-gradient(135deg, #d9826b, #c9946d)`, but the `request_declined` button was missed.

---

### All Email Buttons - Audit Results

| Email Type | Line | Current Background | Status |
|------------|------|-------------------|--------|
| request_approved | 314 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| request_declined | 358 | `#475569` | **WRONG - needs fix** |
| request_received | 405 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| request_cancelled_by_guest | 453 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| collab_cancelled_by_host | 497 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| new_message | 541 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| collab_reminder (host) | 585 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| collab_reminder (guest) | 636 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |
| collab_type_changed | 718 | `linear-gradient(135deg, #d9826b, #c9946d)` | Correct |

---

### Fix

**File to modify:** `supabase/functions/send-collab-email/index.ts`

**Line 358:** Change `background: #475569` to `background: linear-gradient(135deg, #d9826b, #c9946d)`

This is a single-line change that will make the "Discover More Creators" button in declined request emails match the coral brand color used in all other DraftKit emails.

