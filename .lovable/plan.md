

# Add Draft Management & Collaboration Link Features

## Overview

This feature addresses Dinah's feedback about wanting more control over collaboration workflows. Currently, once an AI draft is generated, the creator is limited to regenerating it. We'll add the ability to delete drafts entirely and link to external documents (like Google Docs) for the actual collaborative work.

## Features to Implement

### 1. Delete Draft Button
Allow creators to clear the AI-generated draft and return to the "Generate Draft" state.

### 2. Collaboration Link Field
Add a new input where creators can paste a URL to their shared working document (e.g., Google Doc, Notion page).

### 3. Open Shared Document Button
When a collab_link exists, display a prominent button for both the creator and guest to quickly access the shared workspace.

---

## Database Changes

Add a new column `collab_link` to the `collab_requests` table:

```sql
ALTER TABLE collab_requests
ADD COLUMN collab_link text;
```

This column will store the URL to an external collaboration document.

---

## UI/UX Changes

### CollabDraftModal Component

**Current state:**
- Shows draft content with "Copy Draft" and "Regenerate" buttons

**New state:**
- Add "Delete Draft" button next to "Regenerate"
- Clicking "Delete Draft" clears the `ai_draft` column and closes the modal

### RequestCard Component

**Current state:**
- Shows "Generate Draft" or "View Draft" button
- Draft preview box when draft exists

**New state:**
- Add "Collaboration Link" input field (appears for approved requests)
- Shows "Open Shared Document" button when link exists
- Both creator and guest can see/click the link

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| Database | Add `collab_link` column via migration |
| `src/components/requests/CollabDraftModal.tsx` | Add `onDelete` prop and "Delete Draft" button |
| `src/components/requests/RequestCard.tsx` | Add collab link input, save handler, and display logic |
| `src/pages/Requests.tsx` | Add `handleDraftDeleted` handler and pass to RequestCard |
| `src/pages/MyRequests.tsx` | Show "Open Shared Document" button for guests |

### CollabDraftModal Changes

Add new prop and button:

```typescript
interface CollabDraftModalProps {
  // ... existing props
  onDelete?: () => void;  // NEW
}
```

Add "Delete Draft" button in the actions area:

```tsx
{onDelete && (
  <Button 
    variant="outline" 
    onClick={onDelete}
    className="text-destructive hover:bg-destructive/10"
  >
    <Trash2 className="w-4 h-4 mr-2" />
    Delete Draft
  </Button>
)}
```

### RequestCard Changes

1. **Add local state for collab link:**
```typescript
const [collabLink, setCollabLink] = useState<string>(
  (request as any).collab_link || ""
);
const [isEditingLink, setIsEditingLink] = useState(false);
const [isSavingLink, setIsSavingLink] = useState(false);
```

2. **Add save handler:**
```typescript
const handleSaveCollabLink = async () => {
  setIsSavingLink(true);
  try {
    const { error } = await supabase
      .from('collab_requests')
      .update({ collab_link: collabLink || null })
      .eq('id', request.id);
    
    if (error) throw error;
    toast.success("Collaboration link saved");
    setIsEditingLink(false);
  } catch (error) {
    toast.error("Failed to save link");
  } finally {
    setIsSavingLink(false);
  }
};
```

3. **Add delete draft handler:**
```typescript
const handleDeleteDraft = async () => {
  try {
    const { error } = await supabase
      .from('collab_requests')
      .update({ ai_draft: null })
      .eq('id', request.id);
    
    if (error) throw error;
    
    setLocalDraft(null);
    setShowDraftModal(false);
    toast.success("Draft deleted");
    trackEvent("draft_deleted", { request_id: request.id });
  } catch (error) {
    toast.error("Failed to delete draft");
  }
};
```

4. **Add UI for collab link (in approved section):**
```tsx
{/* Collaboration Link Section */}
{request.status === "approved" && (
  <div className="mt-4 space-y-2">
    {collabLink && !isEditingLink ? (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => window.open(collabLink, "_blank")}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Shared Document
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsEditingLink(true)}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>
    ) : (
      <div className="flex gap-2">
        <Input
          placeholder="Paste collaboration doc link (Google Docs, Notion...)"
          value={collabLink}
          onChange={(e) => setCollabLink(e.target.value)}
        />
        <Button onClick={handleSaveCollabLink} disabled={isSavingLink}>
          Save
        </Button>
        {isEditingLink && (
          <Button variant="ghost" onClick={() => setIsEditingLink(false)}>
            Cancel
          </Button>
        )}
      </div>
    )}
  </div>
)}
```

### Guest View (MyRequests.tsx)

Add "Open Shared Document" button for approved requests when `collab_link` exists:

```tsx
{request.status === 'approved' && (request as any).collab_link && (
  <Button 
    variant="default" 
    size="sm"
    onClick={() => window.open((request as any).collab_link, "_blank")}
  >
    <ExternalLink className="h-4 w-4 mr-1" />
    Open Shared Document
  </Button>
)}
```

---

## User Flow

### Creator Flow
1. Approve a collaboration request
2. Click "Generate Draft" → AI draft appears
3. Optionally: Click "Delete Draft" to remove it and start fresh
4. Paste a Google Doc (or other) link in the "Collaboration Link" field
5. Click "Save" → Link is stored
6. "Open Shared Document" button appears for quick access

### Guest Flow
1. See their approved request in "Sent Requests"
2. If creator has added a collaboration link, see "Open Shared Document" button
3. Click to jump directly to the shared workspace

---

## Summary

This implementation gives creators like Dinah full control over their collaboration workflow:
- **Delete AI drafts** when they want to use their own approach
- **Link external documents** to centralize the collaboration
- **Quick access** for both parties to jump into the shared workspace

