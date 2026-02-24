## Workspace Stickiness and Pro Conversion Redesign

### Goal

Make the DraftKit workspace the default destination for SMART drafts, converting "Copy and Run" users into engaged platform users who are more likely to upgrade to Pro.

### Changes

#### 1. CollabDraftModal.tsx -- Redesign primary action and clean exports

**Primary button**: Replace "Copy Draft" with "Apply to Workspace"

- Full-width orange gradient button
- Clicking it closes the modal and navigates to `/dashboard/workspace/{requestId}`
- Requires adding a `requestId` prop to `CollabDraftModalProps`

**Dropdown menu** (chevron split button becomes standalone "More" dropdown):

- "Copy Raw Text" (moved here from being the primary action)
- "Download as Word (.docx)" (Pro-gated, kept as-is)
- "Upgrade for Export Options" (for non-Pro users, kept as-is)

**Removed entirely**:

- "Open in Google Docs" option
- "Open in New Tab for Google Docs" option
- All Google Docs OAuth/GIS logic and related state (`isExportingToGoogleDocs`)
- `useGoogleDocs` hook import
- `exportToGoogleDocs` import

**Secondary buttons** remain as ghost/outline:

- "Delete Draft" (if `onDelete` exists)
- "Regenerate" (if `onRegenerate` exists)

#### 2. Workspace.tsx -- Rename "AI" to "SMART"

- Line 708: `"View AI Draft"` becomes `"View SMART Draft"`, `"Generate AI Draft"` becomes `"Generate SMART Draft"`
- Line 178: `content_last_edited_by: "AI Draft"` becomes `"SMART Draft"`
- Line 185: Toast message updated from "AI draft saved!" to "SMART draft saved!"

#### 3. RequestCard.tsx -- Pass requestId to CollabDraftModal

- Add `requestId={request.id}` prop when rendering `CollabDraftModal`

### Technical Details

**CollabDraftModalProps changes**:

- Add `requestId?: string` (optional to avoid breaking the interface for both call sites)

**Imports to remove from CollabDraftModal**:

- `useGoogleDocs` hook
- `exportToGoogleDocs` from `@/lib/export-draft`
- `ExternalLink`, `FileIcon`, `Loader2` icons (no longer used)

**Imports to add to CollabDraftModal**:

- `PenLine` from lucide-react (for the "Apply to Workspace" button icon)

**New action layout in the modal footer**:

```text
[====== Apply to Workspace ======]  (orange gradient, full-width)
[Delete Draft]  [Copy/Export v]  [Regenerate]  (outline, secondary row)
```

The "Copy/Export" becomes a small dropdown with "Copy Raw Text" and "Download as Word".

"The plan is approved. One specific implementation detail:

**The 'Apply' Action:** When the user clicks 'Apply to Workspace,' ensure it first calls the backend to save the `ai_draft` into the `shared_content` field (if it's currently empty) before navigating them to the workspace. We want the content to be *there* the moment the page loads, so it feels like the 'Engine' just handed them the keys."

**Files modified**: 3 files total

- `src/components/requests/CollabDraftModal.tsx`
- `src/pages/Workspace.tsx`
- `src/components/requests/RequestCard.tsx`