# Add 14-day reminders and fix long guideline saves

Dinah found two small settings gaps with confirmed causes:

- The reminder system accepts values up to 14 days and calculates them correctly, but the settings menu stops at 7 days.
- Her proposed guidelines are 2,482 characters. The form silently rejects anything over 2,000 characters because it records the validation error but never displays it beside the guidelines field. The database itself has no length restriction.

## What changes

### 1. Add a 14-day reminder choice

Add **“14 days before”** to Collaboration Reminders. Saving it will use the existing reminder process, which emails both participants before a scheduled Collab.

### 2. Support detailed collaboration guidelines

Raise the guidelines allowance to 5,000 characters so Dinah’s full playbook saves without trimming or rewriting it.

Make the limit understandable instead of silent:

- Show a live character count below the field.
- Show the validation message directly below the guidelines when the limit is exceeded.
- Keep the entered text intact after a failed save so nothing is lost.

### 3. Verify the full settings flow

Test that:

- 14 days can be selected, saved, reloaded, and remains selected.
- Dinah’s 2,482-character guidelines save and reload exactly.
- Text over 5,000 characters gets a visible field-level explanation.
- Existing shorter reminder choices and guidelines still save normally.

## Technical notes

- Update the reminder selector in `Settings.tsx`; no reminder worker change is needed because it already subtracts the saved number of days from the scheduled date.
- Update the shared guidelines validation from 2,000 to 5,000 characters and render `errors.collabGuidelines` beside the textarea.
- Add focused validation tests for the new boundary and run the settings-related checks plus the normal type/build verification.
- No database migration or permission changes are needed: `collab_guidelines` is unrestricted text, `reminder_days_before` has no database constraint, and profile updates remain limited to the signed-in owner.
