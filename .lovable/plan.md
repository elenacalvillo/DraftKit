
# Add New Testimonials and Update Raghav's Profile Picture

## Overview
Add two new real testimonials from Karo and Dheeraj to replace the placeholder "Coming Soon" cards, and update Raghav's profile picture across the app.

## Changes Summary

### 1. Add Profile Images to Assets
Copy the uploaded images to the project:
- `karo.jpg` - Karo's profile photo for her testimonial
- `Dheeraj.jpg` - Dheeraj's profile photo for his testimonial
- `Raghav-2.jpg` - New Raghav profile picture (will replace existing `raghav.jpg`)

### 2. Update Testimonials Section
Replace the two "Coming Soon" placeholder testimonials with real feedback:

| Position | Current | New |
|----------|---------|-----|
| 1st | Stefania (keep) | Stefania (unchanged) |
| 2nd | "Coming Soon" placeholder | **Karo** - PM feedback about calendar control |
| 3rd | "Coming Soon" placeholder | **Dheeraj** - Developer feedback about convenience |

**New Testimonials Content:**

**Karo** (PM / Product Manager)
- Quote: "Beautiful build by a fellow PM. I love that my calendar is under my rules and people can only book in the windows I chose."
- Highlight: "my calendar is under my rules"

**Dheeraj** (Newsletter Creator)
- Quote: "That's a really fantastic tool that you build and makes it super convenient. I vibe coded a single page app more like brute force for something similar but I don't think I need it anymore now that you have launched this :)"
- Highlight: "super convenient"

### 3. Update Raghav's Profile Picture
Replace the existing `raghav.jpg` in `src/assets/profiles/` with the new image. This will automatically update anywhere Raghav's image is used (currently in `team-profiles.ts`).

## Files to Modify

```text
Files to create/copy:
  src/assets/profiles/karo.jpg (from user-uploads://karo.jpg)
  src/assets/profiles/dheeraj.jpg (from user-uploads://Dheeraj.jpg)
  src/assets/profiles/raghav.jpg (replace with user-uploads://Raghav-2.jpg)

Files to modify:
  src/components/landing/TestimonialsSection.tsx
    - Import karo and dheeraj images
    - Replace placeholder testimonials with real ones
```

## Technical Details

The testimonials array will be updated to include:
- Proper imports for new profile images
- Real testimonial data with highlight phrases for visual emphasis
- Appropriate role labels ("PM" for Karo, "Newsletter Creator" for Dheeraj)
