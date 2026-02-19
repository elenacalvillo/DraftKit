
## Two Fixes: Dashboard Wordmark Color + Email Brand Header

### What's Wrong

**Issue 1 — Dashboard "DraftKit" wordmark is coral gradient**
In `DashboardLayout.tsx`, both the mobile header and the sidebar logo use `className="... gradient-text"` on the "DraftKit" span. The `gradient-text` CSS class applies a coral/terracotta gradient via `background-image: var(--gradient-primary)`. Per the brand memory, the DraftKit wordmark must use solid dark text (`#2a2318`) everywhere — the gradient is reserved for interactive CTAs only.

**Issue 2 — Emails use generic emoji icons, not the DraftKit brand**
Every email template in `supabase/functions/send-collab-email/index.ts` (and `send-collab-retrospective/index.ts`, `send-release-notes/index.ts`) uses a square gradient tile with an emoji (✨, 📨, 💬, etc.) as the header "logo." There is no DraftKit wordmark or logo in any email.

---

### The Two Fixes

#### Fix 1 — Dashboard Wordmark (`src/components/layout/DashboardLayout.tsx`)

Two instances of `gradient-text` need to become `text-[#2a2318]`:

```tsx
// Mobile header (line 120)
<span className="text-lg font-bold text-[#2a2318]">DraftKit</span>

// Sidebar (line 141)
<span className="text-xl font-bold text-[#2a2318]">DraftKit</span>
```

This is a one-line change per instance — no structural changes needed.

#### Fix 2 — Email Brand Header (`supabase/functions/send-collab-email/index.ts`)

Instead of the generic emoji tile, every email should open with a consistent DraftKit brand header. Since email clients cannot render SVG, the logo is represented as a text-based wordmark using an inline HTML/CSS treatment.

The brand header block replaces all instances of:
```html
<div style="width: 48px; height: 48px; background: linear-gradient(135deg, #d9826b, #c9946d); border-radius: 12px; display: inline-flex; ...">
  <span style="color: white; font-size: 24px;">✨</span>
</div>
```

With a consistent branded header at the top of every email body:

```html
<!-- Brand Header -->
<div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
  <span style="font-size: 22px; font-weight: 700; color: #2a2318; letter-spacing: -0.5px;">Draft</span><span style="font-size: 22px; font-weight: 700; color: #e07b6c; letter-spacing: -0.5px;">Kit</span>
  <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px;">The engine for creators who ship together</p>
</div>
```

This uses the two-tone wordmark approach: "Draft" in dark (`#2a2318`) and "Kit" in coral (`#e07b6c`) — a valid email-safe representation of the brand without SVG. This is a widely used technique (e.g., Stripe, Linear) when SVG logos can't be embedded.

The emoji icon that was inside the gradient tile is preserved — it moves down to become part of the email title section:
```html
<h1 style="margin: 0; font-size: 22px; color: #1e293b;">✨ Collaboration Approved!</h1>
```

**Affected email types in `send-collab-email/index.ts`:**
- `approved` (line 311–316)
- `declined` (line 354–360)
- `new_request` (line 399–405)
- `request_submitted` (line 447–452)
- `request_cancelled_by_guest` (line 508–514)
- `new_message` (line 601–606)
- `new_message_from_guest` (line 644–650)
- `collab_reminder` host & guest variants (~line 678+)

**Also update:**
- `supabase/functions/send-collab-retrospective/index.ts` — the `buildRetrospectiveEmail` function has its own header block
- `supabase/functions/send-release-notes/index.ts` — the header is currently a white-text "DraftKit" on a coral gradient background (line 78–80); replace with the two-tone wordmark on white

---

### Files Changed

| File | Change |
|------|--------|
| `src/components/layout/DashboardLayout.tsx` | Replace `gradient-text` with `text-[#2a2318]` on both "DraftKit" spans |
| `supabase/functions/send-collab-email/index.ts` | Replace generic emoji-tile header with branded two-tone DraftKit wordmark header across all 8+ email types |
| `supabase/functions/send-collab-retrospective/index.ts` | Same header replacement in `buildRetrospectiveEmail` |
| `supabase/functions/send-release-notes/index.ts` | Replace coral gradient header with two-tone wordmark on white |

No database changes. No new dependencies.
