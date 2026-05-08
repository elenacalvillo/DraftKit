// Templates for the 3-strike retention email campaign sent to users
// who still hold credits but haven't logged in for 7+ days.

export type NudgeStrike = 1 | 2 | 3;

export interface NudgeTemplate {
  subject: string;
  body: string;
  label: string;
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  return fullName.trim().split(/\s+/)[0] || "there";
}

export function buildNudge(
  strike: NudgeStrike,
  name: string | null | undefined,
  credits: number
): NudgeTemplate {
  const fn = firstName(name);
  const c = credits;

  if (strike === 1) {
    return {
      label: "Send Strike 1 (Value Debt)",
      subject: "Quick one about your DraftKit credits",
      body:
        `Hey ${fn},\n\n` +
        `I noticed you still have ${c} credits. I just shipped 'Rich Copy'—it keeps your Substack formatting perfectly now. Want to try it?\n\n` +
        `— Sam`,
    };
  }
  if (strike === 2) {
    return {
      label: "Send Strike 2 (New Feature)",
      subject: "Saving ~30 min per post",
      body:
        `Hey ${fn},\n\n` +
        `Still seeing those ${c} credits in your account. Most users are saving ~30 mins per post with the new editor. Is there something specific blocking you from your next draft?\n\n` +
        `— Sam`,
    };
  }
  return {
    label: "Send Strike 3 (Final Check-in)",
    subject: "Last check-in",
    body:
      `Hey ${fn},\n\n` +
      `I'll stop bugging you, but I hate seeing those ${c} credits go to waste. Was the AI output not what you expected, or is DraftKit just not the right fit for your workflow right now?\n\n` +
      `— Sam`,
  };
}

export function strikeForCount(nudgeCount: number): NudgeStrike | null {
  if (nudgeCount === 0) return 1;
  if (nudgeCount === 1) return 2;
  if (nudgeCount === 2) return 3;
  return null;
}
