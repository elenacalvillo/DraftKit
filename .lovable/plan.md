# Karen's deliverability report — audit + fix plan

## What the audit actually shows

I read every edge function that sends mail. **No email is ever sent with a user's email address in the `From` field.** The `From` value is a single static constant in each function:

- `send-collab-email/index.ts:42` → `from: RESEND_FROM` (= `DraftKit Notifications <notifications@draftkit.app>`)
- `send-collab-retrospective/index.ts:20` → `from: RESEND_FROM`
- `project-broadcast/index.ts:52` → `from: RESEND_FROM`
- `send-weekly-digest`, `send-feedback-notification`, `send-release-notes`, `send-ghost-user-recovery`, `monitor-ghost-users`, `send-signup-fix-followup` → all hardcoded `@draftkit.app` senders.

The user's email is only ever placed in `reply_to`, exactly as Karen expected. So the specific fix she pasted ("From is being set to her domain") is **not** what's happening in our code. That means either (a) her IT is misdiagnosing based on the visible "Blessing wrote:" name in the body, or (b) something else on the delivery path is tripping her mail server.

## Realistic root causes for Blessing → Karen bounces

1. **Strict DMARC/anti-spoof on Karen's inbound side** treating an email whose `From` is `notifications@draftkit.app` but whose *display name* / body clearly claims to be "Blessing <blessing@herdomain.com>" as a look-alike/impersonation attempt. Reply-To pointing to a third-party domain amplifies this signal on some scanners (Mimecast, Proofpoint, Google Workspace with strict spoofing rules).
2. **DKIM/SPF alignment on `draftkit.app` itself** — worth verifying via Lovable email domain status.
3. Blessing's address landed in `suppressed_emails` from an earlier bounce/complaint and every subsequent send is silently suppressed.
4. Duplicate-suppression window in `send-collab-email` (the `DEDUP_TYPES` 2-minute gate) is dropping real repeat messages.

## Plan

### 1. Confirm the audit finding to the user, in plain language
Tell Karen: our `From` is already static `notifications@draftkit.app` everywhere, user email is only in `Reply-To`. Share the three file:line references so she can pass them to Blessing's IT.

### 2. Harden the `From` display name to reduce spoof-scanner false positives
In `send-collab-email/index.ts sendEmail()`, accept an optional `fromName` and build the `from` header as:

```
"<Sender Name> via DraftKit <notifications@draftkit.app>"
```

- Domain stays `draftkit.app` → SPF/DKIM/DMARC on our side unchanged.
- The "via DraftKit" pattern is what Google Groups, Substack, Notion, Linear use for exactly this scenario; it's the industry-standard signal to spam filters that this is legitimate relayed mail, not spoofing.
- Only applied when we know the human sender (message emails, workspace-update notifications, invites). System notifications keep the plain `DraftKit Notifications` from.
- Keep `reply_to` = sender's real email (unchanged).

### 3. Instrument + verify delivery for Blessing → Karen specifically
- Check `email_send_log` / `email_events` / `suppressed_emails` for Karen's address to rule out suppression.
- Run `email_domain--check_email_domain_status` for `draftkit.app` to confirm SPF/DKIM/DMARC are green.
- If both are clean, this is receiver-side policy on Karen's tenant and the "via DraftKit" change is the strongest thing we can do from our side.

### 4. Reply the user with findings + next actions
No more code speculation; give Karen the file references, the "via" change we shipped, and the concrete request to forward to Blessing's IT (the actual `From`, SPF result, and message-id from a rejected send).

## Files that will change
- `supabase/functions/send-collab-email/index.ts` — `sendEmail()` signature + call sites for message/invite/update types to pass `fromName`.

## Files intentionally NOT changed
- All other email functions — none of them have the "user acting on behalf" problem; their `From` is correct as-is. No blanket rewrite.
