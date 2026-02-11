

# Fix: Sticky Toolbar Disappearing When Scrolling

## Problem

The formatting toolbar (Bold, Italic, etc.) has `sticky top-[48px]` to stay pinned while scrolling, but the parent `div` has `overflow-hidden` which completely breaks CSS sticky positioning. Sticky requires all ancestors to have visible overflow up to the scroll container.

## Fix (1 file)

### WorkspaceEditor.tsx

Move `overflow-hidden` from the outer flex container to only the `EditorContent` wrapper, so the toolbar can remain sticky while the editor content is still contained.

**Current (line 94):**
```
<div className="flex flex-col min-w-0 overflow-hidden">
```

**New:**
```
<div className="flex flex-col min-w-0">
```

And wrap `EditorContent` in a div with `overflow-hidden min-w-0`:
```
<div className="overflow-hidden min-w-0">
  <EditorContent editor={editor} />
</div>
```

This keeps the text overflow containment on the content area only, while allowing the toolbar's sticky positioning to work correctly against the page scroll.

## Technical summary

| File | Line | Change |
|------|------|--------|
| `src/components/requests/WorkspaceEditor.tsx` | 94 | Remove `overflow-hidden` from outer div |
| `src/components/requests/WorkspaceEditor.tsx` | 205 | Wrap `EditorContent` in a `div` with `overflow-hidden min-w-0` |

No other file changes needed.

