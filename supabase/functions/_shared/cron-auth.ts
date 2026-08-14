// Shared cron auth. Scheduled jobs send the key in x-internal-secret.
// Two names are accepted so the key can be rotated without a window
// where scheduled jobs silently 401.
export function isValidCronSecret(req: Request): boolean {
  const provided = req.headers.get("x-internal-secret");
  if (!provided) return false;
  const accepted = [
    Deno.env.get("CRON_SHARED_KEY"),
    Deno.env.get("CRON_SECRET"),
  ].filter((v): v is string => !!v && v.length > 0);
  return accepted.some((v) => v === provided);
}
