

# Pro-Gate the Shared Workspace ("View-Only" State)

## Overview

Turn the Shared Workspace into a conversion lever: free users see the draft content rendered beautifully but cannot edit it. The Floating Pill hides entirely. Clicking the read-only content surfaces an upgrade prompt.

## Changes

### 1. `Workspace.tsx` -- Pass `isPro` to control editability

Currently `canEdit={true}` is hardcoded (line 403). Change to:

```
canEdit={isPro}
```

This single prop change cascades through `SharedWorkspace` to disable the "Edit Draft" button and block editing for free users.

### 2. `SharedWorkspace.tsx` -- Upgrade CTA on click for free users

- When `canEdit` is false AND content exists, wrap the read-only rendered HTML in a clickable container
- On click, show a toast: "Upgrade to Pro to edit this draft" with an action button linking to settings
- Add a subtle `Lock` icon badge in the top-right corner of the read-only view to signal the content is protected
- Hide the "Edit Draft" / "Start Writing" button entirely when `canEdit` is false (already done via existing conditional)

### 3. `WorkspaceEditor.tsx` -- Hide the Pill for free users

The Floating Pill currently renders when `editable` is true. Since `SharedWorkspace` only renders `WorkspaceEditor` when `isEditing` is true, and free users can never enter edit mode (the button is hidden), the Pill is already effectively hidden. No changes needed here.

### 4. `generate-collab-draft` edge function -- Auto-populate workspace content

After the AI draft JSON is saved (line 617-623), also convert the draft into HTML and write it to `shared_content` so it appears in the workspace immediately for both users:

```sql
shared_content: draftToHtml(draft),
content_last_edited_by: 'AI Draft',
content_last_edited_at: new Date().toISOString(),
```

The `draftToHtml` helper will convert the structured draft into clean HTML:
- `<h1>` for the title
- `<p>` for the hook
- `<h2>` + `<p>` for each outline section (with contributor attribution)
- `<h2>Talking Points</h2>` + `<ul><li>` for talking points
- `<p><em>` for tone notes

### 5. `Workspace.tsx` -- Refresh workspace after draft generation

After `generateDraft()` succeeds, update the local `request` state to include the new `shared_content` so the workspace re-renders immediately without a page reload.

### 6. `UpgradePrompt.tsx` -- Add 'editor' feature type

Add a new feature entry for the editor upgrade CTA:

| Key | Value |
|-----|-------|
| type | `'editor'` |
| title | "Edit & Format Drafts" |
| description | "Take control of the workspace with full editing tools" |
| icon | `PenLine` |

---

## Technical Details

### Files modified

| File | Change |
|------|--------|
| `src/pages/Workspace.tsx` | `canEdit={isPro}`, update state after draft generation |
| `src/components/requests/SharedWorkspace.tsx` | Add click-to-upgrade overlay for free users on read-only content |
| `src/components/subscription/UpgradePrompt.tsx` | Add `'editor'` feature type |
| `supabase/functions/generate-collab-draft/index.ts` | Add `draftToHtml()` helper, write `shared_content` alongside `ai_draft` |

### Free vs Pro experience summary

```text
+---------------------+----------------------------+----------------------------+
| Feature             | Free (Teaser)              | Pro (Engine)               |
+---------------------+----------------------------+----------------------------+
| Draft content       | Visible, read-only         | Fully editable             |
| Pill Toolbar        | Hidden                     | Active, floating           |
| Conversation        | Blurred teaser             | Full history               |
| Click on draft      | Toast + upgrade prompt     | Enters edit mode           |
| "Edit Draft" button | Hidden                     | Visible                    |
+---------------------+----------------------------+----------------------------+
```

### Edge function draft-to-HTML conversion

The structured JSON draft will be converted to semantic HTML matching the workspace's allowed tags (p, h1, h2, h3, strong, em, ul, ol, li). This ensures the auto-populated content renders correctly in the Tiptap editor and passes DOMPurify sanitization.
