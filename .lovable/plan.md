

# Floating Pill Toolbar

## What changes

Replace the current sticky top toolbar in `WorkspaceEditor.tsx` with a fixed-position "frosted glass" pill anchored to the bottom-center of the viewport.

## Single file change: `WorkspaceEditor.tsx`

### Remove
- The entire `sticky top-[48px]` toolbar div (lines 96-201) and its inline position in the component tree

### Add
- A **React Portal** (`createPortal` to `document.body`) rendering the toolbar as a fixed pill
- Only rendered when `editable` is true

### Pill specifications

| Property | Value |
|----------|-------|
| Position | `fixed bottom-8 left-1/2 -translate-x-1/2` |
| Z-index | `z-[100]` |
| Shape | `rounded-full` (pill) |
| Background | `bg-background/80 backdrop-blur-md` |
| Shadow | `shadow-xl border border-border/50` |
| Padding | `px-3 py-2` |
| Layout | Single horizontal row with `flex items-center gap-0.5` |

### Tool groups (same buttons, same Tiptap commands)

1. **Heading dropdown** -- H1/H2/H3/Normal (existing `DropdownMenu`)
2. **Divider** -- subtle `w-px h-5 bg-border/40`
3. **Text styles** -- Bold, Italic, Strikethrough, Inline Code
4. **Divider**
5. **Code Block**
6. **Divider**
7. **Link**
8. **Divider**
9. **Bullet List, Ordered List**

### Active states (unchanged logic)
- Active icon: `bg-primary/10 text-primary`
- Hover: `hover:text-foreground hover:bg-muted/50`

### ToolbarButton update
- Add `hover:scale-105 transition-all` for the interactive feedback requested

### Structural result

```text
<div className="flex flex-col min-w-0">
  {/* Editor content -- no toolbar above it */}
  <div className="overflow-hidden min-w-0">
    <EditorContent editor={editor} />
  </div>

  {/* Floating Pill -- portaled to body */}
  {editable && createPortal(
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]
                    flex items-center gap-0.5 px-3 py-2
                    bg-background/80 backdrop-blur-md
                    rounded-full shadow-xl border border-border/50">
      {/* ...all toolbar buttons... */}
    </div>,
    document.body
  )}
</div>
```

### Why a portal?
Using `createPortal(... , document.body)` makes the pill completely independent of the workspace's DOM hierarchy and overflow settings. It cannot be clipped, cannot scroll away, and needs no sticky hacks.

### Mobile considerations
- The pill is narrow enough (~400px) to fit on mobile screens
- `bottom-8` (32px) keeps it above the safe area on iOS
- It does not overlap the "Save & Sync" button in the Zen header (which is at the top)

No other files need changes.
