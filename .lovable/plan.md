
# Logo Implementation: DraftKitLogo SVG Component

## Context

The `DraftKitLogo` component has never been created — the plan was proposed twice but never executed. This is a clean first implementation. The provisional Sparkles-in-gradient-pill logo needs to be replaced in 7 locations across 6 files.

---

## The `patternUnits` Detail (the core of this request)

The SVG uses a `<pattern>` to render diagonal hatching in the Venn overlap zone. There are two values this attribute can take:

- `patternUnits="objectBoundingBox"` (browser default when omitted) — pattern tile dimensions are expressed as **fractions of the filled element's bounding box**. If the element changes size (e.g. the clip-path circle gets bigger), the tile scales too. This causes the hatch lines to visually "grow" or "shrink" when the `size` prop changes.
- `patternUnits="userSpaceOnUse"` — pattern tile dimensions are expressed in the **SVG's own coordinate system** (the `viewBox="0 0 200 200"` space). The 8×8 tile stays 8 viewBox-units regardless of what element it fills. Since the `viewBox` is fixed and only `width`/`height` scale the whole SVG uniformly, the hatch density is always visually consistent.

The original uploaded SVG already has `patternUnits="userSpaceOnUse"` set. The implementation must preserve this exactly and must **not** accidentally omit it (JSX does not auto-fill SVG attribute defaults).

---

## Implementation

### New file: `src/components/icons/DraftKitLogo.tsx`

```tsx
import { useId } from "react";

export function DraftKitLogo({ size = 32 }: { size?: number }) {
  const uid = useId();
  const patternId = `dk-lines-${uid}`;
  const clipId   = `dk-clip-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"   {/* ← key: tied to viewBox coords, not element bbox */}
          width="8"
          height="8"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#e29e8d" strokeWidth="3" />
        </pattern>
        <clipPath id={clipId}>
          <circle cx="85" cy="100" r="45" />
        </clipPath>
      </defs>

      {/* Hatched overlap fill — right circle's area clipped to left circle shape */}
      <circle
        cx="115" cy="100" r="45"
        fill={`url(#${patternId})`}
        clipPath={`url(#${clipId})`}
        opacity="1"
      />
      {/* Left circle outline — dark */}
      <circle cx="85"  cy="100" r="45" stroke="#2a2318" strokeWidth="3" />
      {/* Right circle outline — coral */}
      <circle cx="115" cy="100" r="45" stroke="#e07b6c" strokeWidth="3" />
    </svg>
  );
}
```

**Why `useId()`:** When the logo renders simultaneously in the sidebar and the mobile header (both mounted at the same time in `DashboardLayout`), two SVG `<defs>` with the same `id` exist in the DOM. The browser uses the **first match**, so the second instance's pattern and clip-path silently reference the wrong element. `useId()` (React 18, already in the project) generates a stable, unique ID per component instance, preventing this collision entirely.

---

## Files to Update

### 1. `src/components/icons/DraftKitLogo.tsx` — **Create**
The component above.

### 2. `src/components/layout/Navbar.tsx`
- Remove `import { Sparkles } from "lucide-react"`
- Replace the `<div className="w-8 h-8 rounded-lg gradient-primary ..."><Sparkles /></div>` wrapper with `<DraftKitLogo size={32} />`

### 3. `src/components/layout/Footer.tsx`
- Remove `Sparkles` from lucide import
- Same swap as Navbar — `size={32}`

### 4. `src/components/layout/DashboardLayout.tsx`
- Remove `Sparkles` from the lucide import list
- Mobile header logo: `size={32}`
- Sidebar logo: `size={40}` (currently `w-10 h-10`, also remove `shadow-glow` on the wrapper div)

### 5. `src/pages/Login.tsx`
- Remove `Sparkles` from lucide import
- Replace the `w-14 h-14 rounded-xl gradient-primary ... shadow-glow` div with `<DraftKitLogo size={56} />`

### 6. `src/pages/Signup.tsx`
- Remove `Sparkles` from lucide import (it appears in Step 1 header only)
- Same swap as Login — `size={56}`

### 7. `src/pages/ForgotPassword.tsx`
- Remove `Sparkles` from lucide import
- Same swap — `size={56}`

### 8. `src/pages/ResetPassword.tsx`
- Remove `Sparkles` from lucide import
- Same swap — `size={56}`

---

## Size Reference

| Location | Old class | New prop |
|----------|-----------|----------|
| Navbar, Footer, mobile header | `w-8 h-8` | `size={32}` |
| Sidebar | `w-10 h-10` | `size={40}` |
| Auth pages (Login, Signup, ForgotPassword, ResetPassword) | `w-14 h-14` | `size={56}` |

---

## What Is Removed

- The `gradient-primary` wrapper `<div>` at every logo site — the SVG carries its own colors
- `shadow-glow` on logo containers — the Venn mark has its own visual weight
- `Sparkles` lucide import from all 6 files (it may remain in other files where it serves a non-logo purpose, e.g. `DashboardLayout`'s nav items do not use it, so it can be cleanly removed)

---

## What Is Not Changed

- The favicon (`public/favicon.ico`) — a separate design step
- Any non-logo usage of `Sparkles` elsewhere in the codebase
- No Tailwind config changes, no new dependencies
