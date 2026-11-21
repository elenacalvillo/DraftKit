# Close the 2 new security findings

## Why new findings keep showing up
Each deep scan is a fresh review that goes further than the last. Fixing one area lets it look deeper, so it finds older issues that were already there. These two are not caused by today's changes: the profile rule dates from December 2025, and the 6 functions were flagged at a lower level before.

## 1. Free accounts could mark themselves as paid (real, fix it)
Today, the protection on plan, credits and Stripe fields works only when a profile is edited, not when it is first created. Someone could create their profile already marked as Pro or on a trial.

Fix: apply the same protection at creation. A new profile always starts on the free plan, with no trial, the default credits and no Stripe link. Only payments, admins and DraftKit's own background tasks can set those fields.

Safe because: the sign-up screen never sends those fields, so normal sign-ups don't change. Existing profiles aren't touched.

Also fix the related warning: someone can't list themselves as their own referrer to earn bonus slots.

## 2. Six functions flagged as "return protected rows" (not a real leak)
The workspace list, saving a draft, restoring a version, leaving a workspace, moving a chapter, and the edit check. I've read the first three and the other three were read in an earlier pass. Each one first checks who is signed in and whether that person has access to that chapter or workspace, then only answers about it. The scanner can't see those checks.

Plan: no code change. Ask you to approve dismissing these 6, with that explanation on each.

## Checks
- Test that a new profile can't start as Pro, on a trial, or with extra credits.
- Test that self-referral gives no bonus.
- Run the existing tests. No browser tests.

## Technical details
- Migration: BEFORE INSERT trigger on creators; when auth.uid() is not null and the caller isn't an admin, force subscription_tier, trial_ends_at, credits, stripe_customer_id, stripe_subscription_id, storage_used_bytes, nudge_count and last_nudge_sent_at to their column defaults.
- award_referral_credit: skip when referred_by = NEW.user_id.
- Mark lov_finding_1254f9d1e210d9c5 and the self-referral finding fixed; propose ignoring the 6 lov_pgscan findings.
