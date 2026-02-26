

## Enable Dividers (Horizontal Rules) in the Workspace Editor

### Problem
The Tiptap editor explicitly disables horizontal rules via `horizontalRule: false` in the StarterKit configuration (line 36 of `WorkspaceEditor.tsx`). This means `-----` or `---` typed in the editor stays as plain text instead of rendering as a `<hr>` divider. Substack supports dividers, so content pasted from or destined for Substack loses its visual structure.

### Changes

#### 1. `src/components/requests/WorkspaceEditor.tsx`
- **Enable horizontalRule**: Remove `horizontalRule: false` from the StarterKit config (or set it to `true`/leave it as default).
- **Add toolbar button**: Add a divider/horizontal-rule button to the floating pill toolbar using the `Minus` icon from lucide-react. Place it after the Lists section with a separator. Clicking it calls `editor.chain().focus().setHorizontalRule().run()`.

#### 2. `src/index.css`
- **Add HR styles** to the `.workspace-prose` block:
  - `hr` element: a subtle horizontal line with margin above and below, using `border-border` color, matching the muted aesthetic of the editor.

#### 3. `src/components/requests/SharedWorkspace.tsx`
- **Update sanitizer allow list**: Add `"hr"` to the `ALLOWED_TAGS` array so that saved horizontal rules are not stripped during sanitization.

### Technical details
- StarterKit's `horizontalRule` extension supports Markdown input rules (`---`, `***`) out of the box once enabled, so users can also type `---` to insert a divider.
- No database changes needed -- `<hr>` is just HTML stored in `shared_content`.

