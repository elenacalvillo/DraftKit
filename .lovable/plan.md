

# Fix: Dismiss Failing on Requests with Legacy Substack URLs

## Root Cause

A CHECK constraint `collab_requests_requester_url_no_profile` blocks any UPDATE on rows where `requester_substack_url` contains `substack.com/@`. Some older requests were created before this constraint existed and still have that URL format. When you click the trash icon to dismiss them, the UPDATE (setting `hidden_by_creator: true`) triggers the constraint and fails.

## Solution

**Drop the CHECK constraint** and replace it with a validation trigger that only runs on INSERT (not on UPDATE). This way:
- New requests still get validated (no `@` profile URLs allowed)
- Existing rows can be updated (dismissed, approved, etc.) without error

## Steps

### 1. Database migration
- Drop the `collab_requests_requester_url_no_profile` CHECK constraint
- Create a trigger function `validate_requester_substack_url()` that rejects INSERTs with `substack.com/@` in the URL
- Attach it as a BEFORE INSERT trigger on `collab_requests`

### 2. No code changes needed
The frontend logic is correct -- the database constraint is the only blocker.

## Technical Detail

```text
Migration SQL:
  1. ALTER TABLE collab_requests DROP CONSTRAINT collab_requests_requester_url_no_profile;
  2. CREATE FUNCTION validate_requester_substack_url() -- checks ONLY on INSERT
  3. CREATE TRIGGER trg_validate_requester_url BEFORE INSERT ON collab_requests
```

This follows the project's existing pattern (see `validate_creator_collab_style` trigger).
