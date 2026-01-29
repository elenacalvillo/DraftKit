

## Early Adopter Classification + Release Notes Email

You currently have **13 creators** in the database. The existing `pro` role already covers your first 6 early adopters. I'll extend this to classify all pre-launch users and create a release notes email system.

---

### Current Early Adopters (already have `pro` role)

| Name | Username | Joined |
|------|----------|--------|
| Elena Calvillo | elenacalvillo | Jan 9 |
| Anna Levitt | bbco | Jan 12 |
| Raghav Mehra | raghav | Jan 13 |
| Karo (Product with Attitude) | karo | Jan 13 |
| The Responsible AI Brief | traib | Jan 13 |
| Stefania Barabas | stefsdevnotes | Jan 14 |

### Additional Pre-Launch Creators (need `pro` role added)

| Name | Username | Joined |
|------|----------|--------|
| Elena Tester | testing | Jan 16 (test account - skip) |
| AI Meets Girlboss | aimeetsgirlboss | Jan 17 |
| Dheeraj Sharma | genaiunplugged | Jan 18 |
| Mia Kiraki | miakiraki | Jan 19 |
| Karen Spinner | karenspinner | Jan 21 |
| Gamal Jastram | gamaljastram | Jan 23 |
| Nick Quick | nickquick | Jan 26 |

---

## Implementation Plan

### Part 1: Extend `pro` Role to All Pre-Launch Creators

Add the 6 remaining real creators (excluding test account) to the `pro` role via a data insert. This marks everyone who joined before launch as an early adopter.

**Data to insert into `user_roles`:**
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'pro'::app_role FROM public.creators
WHERE username NOT IN ('testing') -- skip test account
  AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'pro')
```

---

### Part 2: Create Release Notes Email System

**New edge function: `send-release-notes`**

This function will:
1. Accept a release notes payload (subject, body HTML, target audience)
2. Query all `pro` users (early adopters)
3. Send personalized emails to each creator

**File structure:**
```
supabase/functions/send-release-notes/index.ts
```

**Features:**
- Admin-only access (checks `admin` role)
- Personalized greeting with creator's name
- Brand-consistent HTML template (coral gradient header)
- Rate limiting to avoid Resend limits
- Logs sent emails to `email_events` table

---

### Part 3: Release Notes Email Content

**Subject:** "What's New in DraftKit - January 2026"

**Content highlights:**
1. **SMART Match Ideas** - Content-matched collaboration drafts
2. **Ship Date Workflow** - Clear async collaboration process
3. **Guest Confirmation Emails** - Guests now receive booking receipts
4. **My Collaboration Process** - Personalized booking page experience
5. **Brand refresh** - Coral gradient buttons and consistent styling

---

## Technical Details

### Edge Function: `send-release-notes/index.ts`

```text
+------------------+
|  Admin triggers  |
|  release notes   |
+--------+---------+
         |
         v
+--------+---------+
| Edge function    |
| validates admin  |
+--------+---------+
         |
         v
+--------+---------+
| Query pro users  |
| from user_roles  |
+--------+---------+
         |
         v
+--------+---------+
| Send personalized|
| email via Resend |
+--------+---------+
         |
         v
+--------+---------+
| Log to           |
| email_events     |
+------------------+
```

### Email Template Structure

- **Header**: DraftKit logo with coral gradient background
- **Body**: 
  - Personal greeting ("Hi {name}")
  - Thank you for being an early adopter
  - What's new list (bullet points with feature highlights)
  - CTA button: "Explore Your Dashboard"
- **Footer**: "Thank you for being part of our founding creator community"

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/send-release-notes/index.ts` | Create | New edge function for bulk release notes |
| `user_roles` table | Insert | Add `pro` role to 6 remaining pre-launch creators |

---

## How to Use

After implementation, you'll be able to trigger release notes by calling:

```typescript
// From admin panel or manually
await supabase.functions.invoke('send-release-notes', {
  body: {
    subject: "What's New in DraftKit - January 2026",
    features: [
      { title: "SMART Match Ideas", description: "Get content-matched collaboration drafts" },
      // ... more features
    ]
  }
});
```

---

## Summary

| Task | Effort |
|------|--------|
| Add `pro` role to 6 remaining creators | 1 data insert |
| Create release notes edge function | Medium - new function with HTML template |
| Write release notes content | Content ready (based on completed pre-launch items) |

This gives you a reusable system for future product updates and a clear way to identify your founding creators forever.

