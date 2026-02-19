
## Email Privacy Fix — Hide Raw Addresses Across the UI

### What's Exposed (Reference: the screenshot)

Two places show raw email addresses as visible text:

1. **Workspace sidebar** — The collaborator's email sits openly next to a `Mail` icon (the circled `cashandcache@gmail.com` in the screenshot).
2. **Request cards** — The requester's email appears as a secondary text line under the requested date on every card in the Requests dashboard.

---

### The Fix

#### 1. `src/pages/Workspace.tsx` — Sidebar partner email

**Before:** The email is rendered as plain text:
```tsx
<Mail className="w-4 h-4" />
<span className="text-sm">{partnerEmail}</span>
```

**After:** Replace with an `<a href="mailto:...">` that shows "Send Email" as the label — the actual address is in the `href` attribute (never displayed):
```tsx
<a href={`mailto:${partnerEmail}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
  <Mail className="w-4 h-4 flex-shrink-0" />
  <span>Send Email</span>
</a>
```

The email stays functional (clicking opens the mail client) but is invisible on-screen.

#### 2. `src/components/requests/RequestCard.tsx` — Card requester email

**Before:** A dedicated line renders `request.requesterEmail` as plain text below the date:
```tsx
<Mail className="w-3.5 h-3.5" />
<span className="text-sm text-muted-foreground">{request.requesterEmail}</span>
```

**After:** Remove the text label entirely — keep only the icon, make it a clickable `mailto:` link with an accessible `aria-label`, and a tooltip on hover showing "Send email" (not the address):
```tsx
<a
  href={`mailto:${request.requesterEmail}`}
  aria-label="Send email to requester"
  title="Send email"
  onClick={e => e.stopPropagation()}
  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
>
  <Mail className="w-3.5 h-3.5" />
  <span className="text-sm">Email</span>
</a>
```

This keeps the functionality intact (one click sends email) while removing the exposed address string from the visual UI.

---

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Workspace.tsx` | Replace raw `{partnerEmail}` text with `mailto:` link labeled "Send Email" |
| `src/components/requests/RequestCard.tsx` | Replace raw `{request.requesterEmail}` text with `mailto:` icon-link labeled "Email" |

No database changes. No new dependencies. No edge function changes.

---

### Technical Notes

- The email addresses remain in the DOM as `href` attribute values on anchor tags — this is the standard web pattern and unavoidable without a backend proxy. However, they are **not rendered as visible text**, which addresses the screenshot/sharing privacy concern.
- `e.stopPropagation()` is added to the RequestCard link to prevent the click from bubbling up and accidentally triggering the card's expand/navigate handler.
- The `creatorEmail` prop passed to `RequestCard` from `Requests.tsx` is used internally only for the `send-collab-email` edge function call — it is never rendered to the screen, so no change needed there.
