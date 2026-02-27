

## Fix: Substack URL input squished on mobile

**Problem**: On mobile, the `flex gap-2` row at line 1098 in `src/pages/PublicBooking.tsx` forces the input and "Check Match" button onto one line. The `shrink-0` button wins the space battle, leaving the input unusable.

### Changes

**`src/pages/PublicBooking.tsx` (line 1098)**:
- Change `flex gap-2` to `flex flex-wrap gap-2`
- Change the input's `flex-1` to `flex-1 min-w-0 w-full` so it claims full width when wrapping occurs
- The button already has `shrink-0`, so it will naturally wrap to the next line on narrow screens

Single-line CSS fix, no logic changes.

