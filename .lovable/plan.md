
## Who's affected

Pulled every `creator_creation_failed` event and joined against `creators` to see who still has no profile.

**5 users hit the bug and still have no creator profile:**

| user_id | first fail | last fail | username attempted |
|---|---|---|---|
| c13c8a94… | Jun 25 11:27 | **Jun 26 10:40** | noproduct |
| e86dd784… | Jun 26 01:58 | **Jun 26 02:02** | davidroy / davidroy25 |
| d3aa440e… | Jun 18 20:02 | Jun 18 20:04 | lvanderlinden (Adrian) |
| 7f55bd22… | Jun 11 04:45 | Jun 11 04:46 | — |
| c1e0319b… | Jun 4 19:25 | Jun 4 19:28 | — |

Two waves:
1. **Original outage** (missing RPC) — 4 users, including Adrian. Got the apology email yesterday.
2. **Regression** after the first "fix" — the restored RPC still wrote to `creators.email`, a column that no longer exists. 2 more users blocked (noproduct, davidroy) on Jun 25–26. That's why Adrian still sees the same error: my migration last turn is what actually fixes it.

So **4 others are in the same boat as Adrian** right now (the 2 from wave 1 who never retried + the 2 hit by the regression).

## Plan

Send the same "it works now, try again" email Elena wrote to those 4 users:

- c13c8a94… (noproduct) — wave 2
- e86dd784… (davidroy) — wave 2
- 7f55bd22… — wave 1, never retried
- c1e0319b… — wave 1, never retried

Adrian gets a short personal reply (separate from the bulk send) confirming the real fix shipped and asking him to retry — his last attempt was before the migration that actually removed the `email` column write.

### Steps
1. Pull the 4 email addresses from `auth.users` via a one-off SQL read (auth schema isn't exposed to psql here, so I'll use the Supabase read tool).
2. Draft the send: reuse Elena's copy verbatim, formatted as the existing system email template (PNG Venn-ring header, Inter, dark theme accent).
3. Send via the existing Resend integration — one-off invocation, not a new edge function. No code changes to the app.
4. Draft Adrian's personal reply for you to send from Elena's inbox.

### Out of scope
- No app code changes. The RPC fix already shipped last turn.
- No new tables, no new edge functions, no schema changes.

Want me to proceed with the bulk send + Adrian reply, or just hand you the addresses and drafts to send manually?
