## Goal

When signup profile creation fails for any unexpected reason, tell the user exactly what happened and how to reach Support ([hello@draftkit.app](mailto:hello@draftkit.app)) instead of the current generic "Failed to create profile. Please try again." toast.

The known `creators.email` regression is already patched at the DB layer, so we don't add bespoke handling for it. We focus on every *other* failure path so future surprises are loud and actionable.

## Scope

Frontend only. File: `src/pages/Signup.tsx` (the `reasonToMessage` map + the `rpc_unknown` toast surface around lines 311–346). No backend, no schema, no analytics signal changes.

## Changes

1. Rewrite the user-facing strings in `reasonToMessage` so each one:
  - States what went wrong in plain language.
  - Tells the user what to do next.
  - For anything that isn't user-fixable (`rpc_unknown`, `not_authenticated`, `email_required`), includes a "Email [hello@draftkit.app](mailto:hello@draftkit.app)" call to action with the failure reason code so support can triage fast.
2. Switch the `rpc_unknown` surface from `toast.error(string)` to `toast.error(title, { description, duration, action })`:
  - Title: "We couldn't finish creating your profile"
  - Description: short reason + "Reach out to [hello@draftkit.app](mailto:hello@draftkit.app) and we'll get you in within the hour."
  - Action button: "Email Support" → `mailto:hello@draftkit.app?subject=Signup%20failed&body=...` prefilled with the username they tried, the reason code, and the raw error message so the user doesn't have to retype anything.
  - Longer `duration` (e.g. 15s) so it doesn't disappear before they can read it.
3. Same treatment for the `refreshCreator failed` branch (lines 360–370): today it's silent except for `console.error`. Profile is already committed, so the copy is "Your account was created but we couldn't load it. Refresh the page, or email [hello@draftkit.app](mailto:hello@draftkit.app) if it keeps happening."
4. Keep the existing inline `setErrors({ username })` path for `username_taken` / `username_required` exactly as-is — those are user-fixable and don't need a support hand-off.
5. No changes to analytics. `trackEvent("creator_creation_failed", ...)` stays the same so we keep the observability we added last week.

## Out of scope

- Other error surfaces in the app (Login, Workspace save, etc.). User scoped this to the signup failure they just lived through.
- Adding a generic "contact support" wrapper component. One-file change is enough; a shared component is premature.
- Re-running the `create_creator_profile` RPC fix or touching the DB.

## Verification

- `bunx vitest run src/lib/__tests__/creator-profile.test.ts` to confirm the typed-error contract still holds (we're only touching copy in Signup, but worth a sanity check).
- Manual: trigger a fake failure by temporarily throwing inside the RPC call and confirm the new toast renders with the mailto action.