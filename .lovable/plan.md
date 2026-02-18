
# Logo Replacement: Venn-Ring SVG as the DraftKit Mark

## What's Changing

The provisional logo — a Sparkles icon inside a coral gradient pill — appears in 7 locations across 6 files. Every instance will be replaced with an inline SVG rendering of the new two-circle Venn-ring mark.

## The New Mark

The uploaded SVG is a Venn diagram composed of:
- A left dark-outlined circle (`stroke: #2a2318`)
- A right coral-outlined circle (`stroke: #e07b6c`)
- A hatched fill (`stroke: #e29e8d` diagonal lines) in the overlap zone only

This is the "two creators, one workspace" metaphor in visual form — perfect for DraftKit.

## Implementation Strategy

Rather than paste the full SVG into every file, a single **`DraftKitLogo` component** will be created at `src/components/icons/DraftKitLogo.tsx`. It accepts a `size` prop (defaults to `32`) and renders the SVG inline with unique pattern/clip IDs to avoid conflicts when multiple instances appear on the same page.

```tsx
// src/components/icons/DraftKitLogo.tsx
export function DraftKitLogo({ size = 32 }: { size?: number }) {
  // Unique IDs prevent SVG defs collisions when rendered multiple times
  const uid = useId(); // React 18 useId()
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" ...>
      ...
    </svg>
  );
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/icons/DraftKitLogo.tsx` | **New** — the reusable SVG logo component |
| `src/components/layout/Navbar.tsx` | Replace `gradient-primary` div + `Sparkles` with `<DraftKitLogo size={32} />` |
| `src/components/layout/Footer.tsx` | Replace `gradient-primary` div + `Sparkles` with `<DraftKitLogo size={32} />` |
| `src/components/layout/DashboardLayout.tsx` | Replace both logo instances (sidebar 40px, mobile header 32px) |
| `src/pages/Login.tsx` | Replace the `w-14 h-14` centered hero logo with `<DraftKitLogo size={56} />` |
| `src/pages/Signup.tsx` | Same as Login — centered hero logo swap |
| `src/pages/ForgotPassword.tsx` | Same — centered hero logo swap |
| `src/pages/ResetPassword.tsx` | Same — centered hero logo swap |

## Size Mapping

| Context | Current class | New size prop |
|---------|--------------|---------------|
| Navbar / Footer / Mobile header | `w-8 h-8` | `size={32}` |
| Sidebar (DashboardLayout) | `w-10 h-10` | `size={40}` |
| Auth page hero (Login, Signup, etc.) | `w-14 h-14` | `size={56}` |

## What Gets Removed

- The wrapping `<div className="... gradient-primary ...">` container is removed everywhere — the SVG is self-contained and carries its own colors
- `import { Sparkles } from "lucide-react"` is removed from Navbar, Footer, and DashboardLayout (it may stay in other files where it serves non-logo purposes)
- The `shadow-glow` and `group-hover:shadow-glow` effects on the logo container are dropped since the SVG has its own visual identity; `hover-lift` can still apply to the parent `<Link>` if desired

## Technical Notes

- `useId()` from React 18 is already available (React `^18.3.1` in the project) — it generates stable unique IDs per component instance, preventing SVG `<defs>` ID collisions when the logo renders in both the sidebar and mobile header simultaneously
- The SVG `viewBox="0 0 200 200"` is preserved; width/height are set via the `size` prop
- No new dependencies, no Tailwind config changes
- The favicon (`public/favicon.ico`) is left as-is — updating it is a separate step if desired
