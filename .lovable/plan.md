

# Send Test "What's New" Email — This Week's DraftKit Update

## The Email Content (Based on This Week's Commits)

Here's the email I'll craft and send to hello@elenacalvillo.com, written with the "PM-Led translation" approach — no jargon, all value:

**Subject:** Your Writer's Room just got a serious upgrade

**Body (3 bullets):**

1. **"DraftKit is now a Network, not a task list."**
We've completely rethought how DraftKit talks to you. "Requests" are now "Collabs." "Sent Requests" are now "Proposals." "Discovery" is now "Network." Every label in the app now reflects what you're actually doing: building intentional partnerships, not filing support tickets.

2. **"Your next action is always front and center."**
We redesigned your Collabs page to work like a to-do list, not a history log. Pending proposals show up first under "Needs Your Response." Published collabs move to the archive. Your Dashboard now highlights what needs attention with an "Action Required" badge so you never miss an opportunity.

3. **"Your Substack metrics are now bulletproof."**
We rebuilt the URL parser from scratch. Whether someone shares a mobile link, an app link, a profile-style URL, or the classic format, DraftKit will track your engagement data every time. No more missing metrics on published collabs.

**CTA:** "Open Your Writer's Room →" → links to `/dashboard`

**Sign-off:** – Elena, Founder, DraftKit

## How I'll Send It

I'll use the existing `send-release-notes` edge function pattern to send a single email via Resend directly to hello@elenacalvillo.com. Since that function is admin-gated and sends to all pro users, I'll create a tiny one-off edge function that:

1. Reads the `RESEND_API_KEY` from env
2. Sends the crafted HTML to `hello@elenacalvillo.com` using `from: "DraftKit <hello@draftkit.app>"`
3. Returns success/failure

I'll deploy it, call it once to send the email, then delete it. The brand header, colors, and layout will match the existing `send-release-notes` template exactly (DraftKit wordmark, coral accent, warm gradient CTA button).

## Files

| File | Change |
|------|--------|
| `supabase/functions/send-test-whatsnew/index.ts` | Temporary: one-off email sender with hardcoded HTML |
| (cleanup) | Delete the function after successful send |

