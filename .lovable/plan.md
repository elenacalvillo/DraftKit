# Automated Weekly "What's New" Digest — Cron + AI + Resend

## Architecture

A single edge function `send-weekly-digest` triggered by pg_cron every Friday at 10 AM CST. No GitHub token needed — the repo is public.

```text
pg_cron (Friday 10AM)
  → send-weekly-digest edge function
    → GitHub API: fetch commits from last 7 days
    → Filter: drop chore/refactor/test/deps/ci/build/style/docs prefixes
    → Threshold: < 2 meaningful commits? Skip, log "nothing to send"
    → Lovable AI: transform commits into 3 value-driven bullets
    → Resend Broadcast API: send to audience 84fa3259-a54a-4c06-9493-e0bd9d720fd0
```

## The Edge Function: `send-weekly-digest`

**Step 1 — Fetch commits**
Call `https://api.github.com/repos/elenacalvillo/DraftKit/commits?since={7_days_ago}&per_page=100`. No auth needed for public repos.

I change the project name to DraftKit in GitHub, and turned it public. It shouldn't matter to you because you already have the established connection in Lovable's project.

**Step 2 — Filter noise**
Strip commits whose message starts with `chore:`, `refactor:`, `test:`, `deps:`, `ci:`, `build:`, `style:`, `docs:` (case-insensitive). Also filter out merge commits and Lovable auto-generated messages that aren't user-facing.

**Step 3 — Threshold check**
If fewer than 2 commits remain, return `{ skipped: true, reason: "insufficient signal" }`. No email sent.

"If any commit message is less than 10 characters or just says 'Update' or 'Fix', ignore it."

**Step 4 — AI transformation**
Call Lovable AI Gateway (`google/gemini-3-flash-preview`) with this system prompt:

> "You are Elena, PM of DraftKit. Your job is to turn technical git commits into a 'What's New' email with exactly 3 bullet points. Rules: Transform, don't summarize. Focus on the 'Superpower' — tell the user what they can do now. Tone: natural, punchy, no jargon. NEVER use: 'delve', 'unlock', 'harness', 'leverage', 'empower', 'streamline', 'cutting-edge', 'game-changer', 'best-in-class', em dashes, or exclamation marks in headers. If a commit is a bug fix, explain why the user's life is easier now. Each bullet: bold title (6 words max), then 1-2 sentence explanation. Also generate a punchy email subject line (under 50 chars)."

Use tool calling to get structured output: `{ subject, bullets: [{ title, body }] }`.

**"Safety Switches"** to the script:

### 1. The Cost Cap (Max Tokens)

Tell Lovable: **"Set the AI** `max_tokens` **to 300."**

- **Why:** This forces the AI to be brief (which you prefer anyway) and ensures you never pay for a "long-winded" response. At 300 tokens, you could run this for years without hitting a $1.00 bill.

### 2. The Hallucination Guard (Strict Context)

Tell Lovable: **"Add a 'Strict Grounding' instruction to the AI prompt."**

- **The Instruction:** "Do not invent features or benefits. If a commit message is ambiguous, ignore it. Use only the provided text as the source of truth."
- **Why:** This prevents the AI from "guessing" what a technical fix does. If the commit says `fix: button color`, it won't hallucinate that you "revolutionized the UI."

**Step 5 — Send via Resend Broadcast**
Use Resend's `POST /broadcasts` API to create a broadcast to audience `84fa3259-a54a-4c06-9493-e0bd9d720fd0`, then send it. The email HTML reuses the existing brand template (DraftKit wordmark header, coral CTA, warm footer). Sign-off: `– Elena` (no dash before the name, just an en-dash).

Wait — you said "kill the dash in the sign-off." I'll change it to just `Elena` with `Founder, DraftKit` below.

## The Cron Job

SQL (run via insert tool, not migration — contains project-specific URLs):

```sql
SELECT cron.schedule(
  'weekly-whatsnew-digest',
  '0 16 * * 5',  -- 10 AM CST = 16:00 UTC on Fridays
  $$ SELECT net.http_post(
    url := 'https://cbgchxesngdsvkevbqwh.supabase.co/functions/v1/send-weekly-digest',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id; $$
);
```

## Config

Add to `supabase/config.toml`:

```toml
[functions.send-weekly-digest]
verify_jwt = false
```

## Guardrails Summary


| Guardrail         | Implementation                                     |
| ----------------- | -------------------------------------------------- |
| Signal filter     | Regex prefix match on conventional commit types    |
| Minimum threshold | < 2 meaningful commits → no send                   |
| Anti-corporate    | Explicit banned-word list in system prompt         |
| Drift protection  | Structured output via tool calling (not free-form) |


Use tool calling to get structured output: `{ subject, bullets: [{ title, body }] }`.

**"Safety Switches"** to the script:

### 1. The Cost Cap (Max Tokens)

Tell Lovable: **"Set the AI** `max_tokens` **to 300."**

- **Why:** This forces the AI to be brief (which you prefer anyway) and ensures you never pay for a "long-winded" response. At 300 tokens, you could run this for years without hitting a $1.00 bill.

### 2. The Hallucination Guard (Strict Context)

Tell Lovable: **"Add a 'Strict Grounding' instruction to the AI prompt."**

- **The Instruction:** "Do not invent features or benefits. If a commit message is ambiguous, ignore it. Use only the provided text as the source of truth."
- **Why:** This prevents the AI from "guessing" what a technical fix does. If the commit says `fix: button color`, it won't hallucinate that you "revolutionized the UI."

&nbsp;

## Files


| File                                             | Change                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `supabase/functions/send-weekly-digest/index.ts` | New: fetch commits, filter, AI transform, Resend broadcast |
| `supabase/config.toml`                           | Add `send-weekly-digest` function config                   |
| SQL (via insert tool)                            | pg_cron schedule for Friday 10 AM CST                      |
