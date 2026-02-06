

# Fix: Dinah's Profile Not Visible to Public

## Problem Summary
Dinah created her account and her profile exists in the database with username `codelikeagirl`, but visitors to `draftkit.app/codelikeagirl` see "Creator Not Found".

## Root Cause
The `public_creator_profiles` view uses `security_invoker = on`, which means it runs with the permissions of the user making the request. When anyone visits the public booking page, they're querying through this view, which in turn queries the `creators` table. However, the `creators` table RLS only allows users to see **their own** profile:

```sql
Policy: "Creators can view own profile"
USING: (auth.uid() = user_id)
```

Since visitors aren't Dinah, they can't see her profile - the RLS blocks it.

---

## Solution
Add a new RLS policy on the `creators` table that allows public SELECT access for profiles with a non-null username. This follows the existing pattern in the `availability` table which already has a similar policy.

### New Policy
```sql
CREATE POLICY "Public can view public creator profiles"
ON public.creators
FOR SELECT
USING (username IS NOT NULL);
```

This policy allows anyone (anon or authenticated) to read creator records where the username is set, which indicates the creator has completed their public profile setup.

---

## Technical Details

### Why the current setup fails

| Step | What Happens |
|------|--------------|
| 1 | Visitor loads `/codelikeagirl` |
| 2 | App queries `public_creator_profiles` view |
| 3 | View (with `security_invoker=on`) queries `creators` table |
| 4 | RLS checks: `auth.uid() = user_id` → FALSE (visitor ≠ Dinah) |
| 5 | Query returns empty array `[]` |
| 6 | App shows "Creator Not Found" |

### After the fix

| Step | What Happens |
|------|--------------|
| 1 | Visitor loads `/codelikeagirl` |
| 2 | App queries `public_creator_profiles` view |
| 3 | View queries `creators` table |
| 4 | RLS checks: `username IS NOT NULL` → TRUE |
| 5 | Query returns Dinah's profile (without email - view excludes it) |
| 6 | App shows Dinah's public booking page |

---

## Security Considerations

1. The `public_creator_profiles` VIEW already excludes sensitive data like email addresses - it only exposes public profile fields
2. The `creator_contacts` table (which has the email) has separate strict RLS policies
3. This follows the same pattern as the `availability` table which allows public SELECT for creators with non-null usernames
4. The policy only enables SELECT, not INSERT/UPDATE/DELETE

---

## Files to Modify

| Change | Description |
|--------|-------------|
| Database Migration | Add RLS policy allowing public SELECT on creators with non-null username |

---

## Migration SQL

```sql
-- Allow public access to creator profiles that have a username set
-- The public_creator_profiles view already filters out sensitive data (email)
CREATE POLICY "Public can view public creator profiles"
ON public.creators
FOR SELECT
USING (username IS NOT NULL);
```

