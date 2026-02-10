

# Zen Mode Workspace + Code Block Button

## Overview

Three changes: (1) replace the global mobile navbar with a minimal "Workspace Header" on the workspace route, (2) add a code block button to the editor toolbar, and (3) update the sanitizer to allow `<pre>` tags.

---

## 1. Workspace Header ("Zen Mode") on Mobile

### How it works

`DashboardLayout` currently renders a fixed mobile header with the DraftKit logo and hamburger menu on all routes. For the workspace route, we replace it with a slimmed-down header that only shows:

- **Back arrow** (navigates to requests)
- **Collaboration title** (e.g. "Workspace with Dinah")
- **No hamburger menu**, no logo, no sidebar toggle

### Implementation: `DashboardLayout.tsx`

Add an optional `zenMode` prop and a `zenTitle` prop:

```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
  zenMode?: boolean;      // hides global nav, shows minimal header
  zenTitle?: string;       // title for the zen header
  zenBackPath?: string;    // where "Back" goes
}
```

When `zenMode` is true:
- **Mobile header**: Render a minimal bar with just a Back button and the title (no logo, no hamburger)
- **Desktop sidebar**: Still visible (it doesn't eat screen space on desktop since it's a side panel)
- **Main content**: `pt-14` instead of `pt-16` on mobile (slightly smaller header)

### Implementation: `Workspace.tsx`

Pass the zen props to DashboardLayout:

```tsx
<DashboardLayout
  zenMode={true}
  zenTitle={`Workspace with ${partnerName}`}
  zenBackPath={backPath}
>
```

This keeps all existing pages untouched (they don't pass `zenMode`), and the workspace gets its focused header.

---

## 2. Code Block Toolbar Button

### `WorkspaceEditor.tsx`

- Remove `codeBlock: false` from the StarterKit config (re-enables code blocks)
- Import `CodeSquare` from lucide-react
- Add a new toolbar button after the inline Code button, separated by a divider:

```tsx
<ToolbarButton
  active={editor.isActive("codeBlock")}
  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
  title="Code block"
>
  <CodeSquare className="w-4 h-4" />
</ToolbarButton>
```

---

## 3. Sanitizer Update

### `SharedWorkspace.tsx`

Add `"pre"` to the `ALLOWED_TAGS` array so code blocks (`<pre><code>...</code></pre>`) render correctly in view mode:

```typescript
const ALLOWED_TAGS = ["p", "h1", "h2", "h3", "strong", "em", "s", "code", "pre", "a", "ul", "ol", "li", "br"];
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/layout/DashboardLayout.tsx` | Add `zenMode`/`zenTitle`/`zenBackPath` props; render minimal header when zen |
| `src/pages/Workspace.tsx` | Pass zen props to DashboardLayout |
| `src/components/requests/WorkspaceEditor.tsx` | Enable codeBlock, add CodeSquare toolbar button |
| `src/components/requests/SharedWorkspace.tsx` | Add `"pre"` to ALLOWED_TAGS |

No database or edge function changes needed.

