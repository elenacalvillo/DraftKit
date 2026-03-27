# Tables + Sticky Highlight Comments in the Workspace Editor

## Overview

Two features added to the existing Tiptap editor: (1) native table support and (2) inline sticky comments stored as custom marks in the HTML.

---

## Feature 1: Tables

### Install

- `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`

### Changes

`**src/components/requests/WorkspaceEditor.tsx**`

- Import the four table extensions and add them to the `extensions` array
- Add a "Table" dropdown button to the floating toolbar (after the Divider button) with options: Insert Table (3x3), Add Row, Add Column, Delete Table
- Use `Table2` icon from lucide-react

`**src/index.css**`

- Add table styles under `.workspace-prose`:
  ```css
  .workspace-prose table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
  .workspace-prose th, .workspace-prose td { border: 1px solid hsl(var(--border) / 0.5); padding: 0.5rem 0.75rem; text-align: left; }
  .workspace-prose th { background: hsl(var(--muted) / 0.3); font-weight: 600; }
  .workspace-prose .selectedCell { background: hsl(var(--primary) / 0.08); }
  ```

`**src/components/requests/SharedWorkspace.tsx**`

- Add `table`, `thead`, `tbody`, `tr`, `th`, `td` to `ALLOWED_TAGS`
- Add `colspan`, `rowspan`, `colwidth` to `ALLOWED_ATTR`

---

## Feature 2: Sticky Highlight Comments

### Concept

A custom Tiptap Mark called `stickyComment` wraps selected text in a `<span>` with `class="dk-highlight"` and a `data-comment` + `data-author` attribute. Comments are stored directly in the HTML (no new DB tables). On hover, a tooltip shows the comment and author.

### Changes

**New file: `src/lib/tiptap-sticky-comment.ts**`

- Define a custom Tiptap Mark extension:
  - Name: `stickyComment`
  - Attributes: `comment` (string), `author` (string)
  - Renders as `<span class="dk-highlight" data-comment="..." data-author="...">`
  - Parses `<span>` elements with `dk-highlight` class
  - Commands: `setStickyComment({ comment, author })`, `unsetStickyComment()`, `updateStickyComment({ comment })`

`**src/components/requests/WorkspaceEditor.tsx**`

- Accept new prop: `currentUserName: string`
- Import the `stickyComment` mark and add to extensions
- Add a `Highlighter` icon button to the toolbar (after Link, before Lists)
- On click:
  - If cursor is inside an existing highlight: show a small popover (positioned near the toolbar) with the existing comment, allowing edit or delete (remove mark)
  - If text is selected and no highlight: prompt for comment via a small floating input (a controlled state with a yellow-tinted card), then apply `setStickyComment`
- Add hover tooltip logic: use an `EditorView` plugin or a React component that listens to `mouseover` events on `.dk-highlight` spans and shows a tooltip with the `data-comment` and `data-author` content

**New file: `src/components/requests/HighlightTooltip.tsx**`

- A React component rendered inside the editor container
- Listens to `mouseenter`/`mouseleave` on `.dk-highlight` elements within the editor DOM
- Shows a small tooltip (absolute positioned) with the comment text and author name
- Styled with soft yellow background matching the highlight

**New file: `src/components/requests/CommentInput.tsx**`

- A small floating card component (yellow-tinted, `bg-yellow-50 dark:bg-yellow-900/20`) that appears when the user clicks the Highlighter button with text selected
- Contains a textarea and Save/Cancel buttons
- On save, calls `editor.chain().focus().setStickyComment({ comment, author }).run()`

`**src/components/requests/SharedWorkspace.tsx**`

- Pass `currentUserName` to `WorkspaceEditor`
- Add `span` to `ALLOWED_TAGS`
- Add `class`, `data-comment`, `data-author` to `ALLOWED_ATTR` (so DOMPurify preserves highlights)  
Note: The plan mentions a `data-author` attribute. Ensure Lovable pulls the **Display Name** from your Supabase `profiles` table rather than just a UUID. It should say "Elena: [comment]" not "4f7b...: [comment]."

`**src/index.css**`

- Add highlight styles:
  ```css
  .workspace-prose .dk-highlight {
    background: hsl(45 93% 80% / 0.4);
    border-bottom: 2px solid hsl(45 93% 60% / 0.6);
    padding: 1px 0;
    cursor: pointer;
    border-radius: 2px;
  }
  ```

### Lifecycle

- **Create**: Select text → click Highlighter → type comment → save
- **View**: Hover highlighted text → tooltip with comment + author (**The Mobile Constraint:** On a phone, "hover" doesn't exist. Ask Lovable to ensure that a **single tap** on a highlight also triggers the tooltip for your mobile users.)
- **Edit**: Click existing highlight (in edit mode) → comment input pre-filled → update
- **Delete**: Click existing highlight → delete button removes the mark
- **Resolve**: Same as delete — removes highlight and comment

### No new database tables needed

Comments live inside `shared_content` HTML as `data-comment` attributes on `<span>` elements.

---

## Files Summary


| File                                           | Change                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `package.json`                                 | Add 4 tiptap table extensions                                   |
| `src/components/requests/WorkspaceEditor.tsx`  | Table buttons, highlighter button, comment input state, tooltip |
| `src/lib/tiptap-sticky-comment.ts`             | New custom Tiptap Mark extension                                |
| `src/components/requests/HighlightTooltip.tsx` | New hover tooltip component                                     |
| `src/components/requests/CommentInput.tsx`     | New floating comment input component                            |
| `src/components/requests/SharedWorkspace.tsx`  | Update ALLOWED_TAGS/ATTR, pass currentUserName                  |
| `src/index.css`                                | Table styles + `.dk-highlight` styles                           |
