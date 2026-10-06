# Fix the wrong sender name in chapter message emails

## What's going on (confirmed in the code and send records)

Delivery works. Since the last fix, chapter messages and updates do reach Karen (collabs@shewritesai.org) and the other people on each chapter. The problem is the wording.

The email doesn't use the name of the person who actually wrote the message. It picks names from the chapter record. On a book chapter, both the "host" and the "guest" on that record are Karen's account (She Writes AI Community), so every message email reads:

- From: "She Writes AI Community via DraftKit"
- "Hi She Writes AI Community, She Writes AI Community sent you a message"
- Reply-To: collabs@shewritesai.org, so hitting Reply sends the reply to Karen, not Patricia

The same naming issue affects:
- **Chapter update emails** (Notify on save)
- **Emails going the other way**: when Karen messages Patricia, Patricia's email also opens with "Hi She Writes AI Community"
- **Shared greeting**: every recipient gets the same "Hi <name>" line, even though each email now goes to several people

Regular one-to-one collabs aren't affected, because there the host and guest really are two different people.

## The fix

1. **Use the real sender's name.** The email service looks up the signed-in person who sent the message or update, using their DraftKit profile name and falling back to their email. That name goes in the From line, the subject, and the line "Patricia Gestoso sent you a message".
2. **Greet each person by name.** Each recipient gets "Hi <their name>". If we don't know a recipient's name, the email just says "Hi,".
3. **Make Reply go to the sender.** The Reply-To address is the actual sender, so replying from email reaches Patricia.
4. **Drop the direction guessing for workspace emails.** Messages and updates read the same whether the host or a writer sends them. That stops Karen's replies being labeled as if they came from the guest.
5. **Update the spec.** Add a "sender identity" row to the email table in the spec doc: who appears as the sender, who is greeted, and where replies go.

## What Karen will see

"Patricia Gestoso via DraftKit". "Hi Karen, Patricia Gestoso sent you a message about your chapter." Hitting Reply goes to Patricia.

## Technical notes

- `supabase/functions/send-collab-email/index.ts`: for `new_message`, `new_message_from_guest`, `workspace_updated_by_*`, resolve the sender from the JWT `userId` (creators.name, then auth email). Override `fromName`, `replyTo` and the "sent you" name with it. Render the HTML once per recipient inside the fan-out loop, looking up each recipient's name by email through creators/creator_contacts. Use "your chapter" wording when `is_project_workspace` is true. Redeploy.
- Client callers stay as they are. Identity comes from the server, so it can't be spoofed.
- No schema changes. No resend of past emails.
