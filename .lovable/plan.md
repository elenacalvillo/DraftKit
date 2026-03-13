Goal: fix the Discovery failure and the console warning in one pass.

What is actually failing now

- The blocking failure is backend fetch logic in `fetch-substack-recommendations`, not the UI rendering.
- Current edge logs stop after `Resolving publication ID...`, and network responses return:
`{"error":"Could not find Substack publication for \"promptledproduct\"","recommendations":[]}`.
- Root cause: `resolvePublicationId()` expects the search API response to be an array, but Substack currently returns an object with `results: [...]`.
- Separate issue: the repeated React warning is from `Skeleton` being a plain function component receiving a ref from parent composition; noisy but not the reason recommendations fail.

Implementation plan

1. Fix publication ID resolution parsing (main blocker)

- File: `supabase/functions/fetch-substack-recommendations/index.ts`
- Update `resolvePublicationId()` to support both response shapes:
  - Array response (legacy)
  - Object response with `results` array (current)
- Match exact subdomain first; then safe fallback to first result with valid `id`.
- Add a compact diagnostic log for response shape and candidate count.

2. Harden recommendation mapping

- File: `supabase/functions/fetch-substack-recommendations/index.ts`
- Keep JSON API flow (`/recommendations/from/{id}`), but tighten field mapping:
  - Prefer `pub.subdomain`, fallback to parsing `custom_domain` only if needed
  - Avoid `custom_domain_optional` as a subdomain fallback (it is boolean metadata, not URL)
- Keep output contract unchanged for frontend compatibility.

3. Fix Discovery fetch enablement edge case

- File: `src/pages/Discovery.tsx`
- Change query `enabled` and “no URL configured” checks to use:
`creator.newsletter_url || creator.substack_url`
- This prevents false negatives for users with only publication URL populated.

4. Remove noisy ref warning

- File: `src/components/ui/skeleton.tsx`
- Convert `Skeleton` to `React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>`.
- Keep same styling/classes and API.

5. Verification checklist after implementation

- Call backend function once and confirm it returns non-empty `recommendations` for `promptledproduct`.
- Confirm rows are inserted/upserted in:
  - `discovered_publications`
  - `creator_recommendations` for your creator id
- Open `/dashboard/discovery` and verify cards render.
- Confirm the console no longer shows “Function components cannot be given refs” for `Skeleton`.

Technical details

- No database migration required.
- No auth flow change required.
- No UI redesign required.
- This is a compatibility fix for an upstream API shape change + a local React ref warning cleanup.

Fix the Discovery feature failure and the console warnings while completing the landing page update in one pass. This is an additive update. Do not remove existing testimonials or the interview section.

**I. Substack API and Discovery Technical Fixes**

1. **Edge Function Fix:** Modify `supabase/functions/fetch-substack-recommendations/index.ts`. Update the `resolvePublicationId` function to handle the new Substack API response shape. It now returns an object with a `results` array. Match the exact subdomain first and then fallback to the first result with a valid ID.
2. **Field Mapping:** In the same function, prioritize `pub.subdomain` for mapping. Only use `custom_domain` as a fallback and avoid using the boolean `custom_domain_optional` as a URL.
3. **Discovery Logic:** Update `src/pages/Discovery.tsx` to enable the query if either `newsletter_url` or `substack_url` is present.
4. **Ref Warning:** Convert `src/components/ui/skeleton.tsx` to a `React.forwardRef` component to stop the console ref warnings.