

# Rich Text Editor + Smart Notifications for Shared Workspace

## Overview

Upgrade the plain textarea in SharedWorkspace to a Substack-lite rich text editor using **Tiptap**, and add opt-in email notifications on save. The editor will support only text formatting -- no images, no videos, no undo/redo buttons. Content is stored as sanitized HTML.

---

## 1. New Dependencies

Install the following npm packages:

| Package | Purpose |
|---------|---------|
| `@tiptap/react` | React integration for the editor |
| `@tiptap/starter-kit` | Bundles Bold, Italic, Strikethrough, Headings, Lists, Code, etc. |
| `@tiptap/pm` | Required peer dependency (ProseMirror engine) |
| `@tiptap/extension-link` | Clickable, validated hyperlinks |
| `dompurify` | Sanitize HTML before saving to prevent XSS |
| `@types/dompurify` | TypeScript types |

StarterKit already includes: Bold, Italic, Strike, Code, Headings (H1-H3), Bullet List, Ordered List, Blockquote, Code Block, Hard Break, and more. We disable what we don't need.

---

## 2. Database Changes

**None.** The existing `shared_content` column (type: text) will now store sanitized HTML instead of plain text. No migration needed.

---

## 3. New Component: `WorkspaceEditor.tsx`

Create `src/components/requests/WorkspaceEditor.tsx` -- a self-contained Tiptap editor with a toolbar.

### Toolbar Buttons (matching the pink-circled Substack features)

```text
[ Style dropdown (H1, H2, H3, Paragraph) ] | [ B ] [ I ] [ S ] [ <> ] | [ Link ] | [ Bullet List ] [ Numbered List ]
```

- **Style dropdown**: Heading 1, Heading 2, Heading 3, Paragraph (Normal text)
- **Bold** (B), **Italic** (I), **Strikethrough** (S), **Inline Code** (<>)
- **Link**: Prompts for URL, validates it starts with `https://`
- **Bullet List**, **Numbered List**
- **No**: Undo/Redo, images, videos, embeds, blockquote, code block

### Editor Configuration

```typescript
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Disable features we don't want
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    validate: (href) => /^https?:\/\//.test(href), // Only allow http/https links
  }),
];
```

### Props

```typescript
interface WorkspaceEditorProps {
  content: string;          // HTML string
  onChange: (html: string) => void;
  editable: boolean;
}
```

### Styling

- The editor area uses serif font (Georgia) to match the current writing feel
- Toolbar has a clean, minimal design with icon buttons and a heading dropdown
- Prose-style content rendering using Tailwind typography classes applied to the editor's `.ProseMirror` element
- Minimum height of 300px for the editing area

---

## 4. Updated `SharedWorkspace.tsx`

Major rewrite to use the new editor:

### View Mode
- Renders `shared_content` as sanitized HTML using `dangerouslySetInnerHTML` with DOMPurify
- Shows "Last updated by" footer
- "Edit Draft" button

### Edit Mode
- Replaces the textarea with `WorkspaceEditor`
- Anti-collision banner stays the same
- **New**: "Notify collaborator via email" checkbox next to Save button (defaults to **unchecked**)
- Save flow:
  1. Sanitize HTML with DOMPurify before saving
  2. Update `shared_content`, `content_last_edited_by`, `content_last_edited_at` in database
  3. If "Notify" checkbox is checked, call `send-collab-email` with a new `workspace_updated` type
  4. Switch back to View Mode

### Security: HTML Sanitization

```typescript
import DOMPurify from 'dompurify';

// Before saving
const cleanHtml = DOMPurify.sanitize(editor.getHTML(), {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 's', 'code', 'a', 'ul', 'ol', 'li', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
});

// Before rendering in view mode
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sharedContent) }} />
```

### Link Security
- Tiptap's Link extension validates URLs must start with `https://`
- DOMPurify strips any `javascript:` or data URIs
- Only `href`, `target`, and `rel` attributes allowed on links

---

## 5. Email Notification: `workspace_updated` Type

### Edge Function Update (`send-collab-email/index.ts`)

Add a new email type `workspace_updated` to the existing email function:

- **Role**: Either `creator` or `requester` can trigger it (both can edit)
- **Recipient**: The "other" party (if creator saves, email goes to guest; if guest saves, email goes to creator)
- **Subject**: "[Name] updated the shared workspace"
- **Body**: Simple notification with a CTA button linking to the workspace page
- **No content preview** in the email (keeps it clean, avoids leaking draft content via email)

Add to the `EMAIL_TYPE_ROLES` map:

```typescript
workspace_updated: "creator", // Will need special handling: either party can trigger
```

Actually, since either party can trigger this, we'll add two types:
- `workspace_updated_by_creator` (role: `creator`, sends to guest)
- `workspace_updated_by_guest` (role: `requester`, sends to creator)

### Frontend: Checkbox UI

In the Save footer area of SharedWorkspace:

```text
[ ] Notify [Partner Name] via email     [Cancel] [Save & Sync]
```

The checkbox label dynamically shows the partner's name. When checked, the save handler fires the email after a successful database update (fire-and-forget, like existing message emails).

---

## 6. Files Summary

| File | Action |
|------|--------|
| `src/components/requests/WorkspaceEditor.tsx` | **Create** -- Tiptap editor with toolbar |
| `src/components/requests/SharedWorkspace.tsx` | **Rewrite** -- Replace textarea with Tiptap, add notify checkbox, render HTML |
| `src/pages/Workspace.tsx` | **Minor edit** -- Pass partner name to SharedWorkspace for the notify checkbox label |
| `supabase/functions/send-collab-email/index.ts` | **Edit** -- Add `workspace_updated_by_creator` and `workspace_updated_by_guest` email types |

### No changes needed to:
- Database schema (reusing existing `shared_content` text column for HTML)
- RLS policies
- `App.tsx` routing

---

## Technical Notes

### Why Tiptap over alternatives
- **Headless**: We control the UI entirely -- no imposed styles to fight
- **StarterKit**: One package gives us all the formatting we need
- **Link extension**: Built-in URL validation
- **ProseMirror-based**: Battle-tested, same engine Substack uses internally

### Content Migration
- Any existing plain text in `shared_content` will render as-is inside the Tiptap editor (it treats plain text as a paragraph). No migration needed.

### Performance
- Tiptap adds ~50-80KB gzipped to the bundle. This is only loaded on the Workspace page (code-split via React Router lazy loading if desired later).
- No WebSockets or Realtime subscriptions -- still uses standard GET/POST.

