

# Fix Export to Docs Feature

## Problem Analysis

Two issues were identified during testing:

### Issue 1: Google Docs Opens Blank
The URL scheme `https://docs.google.com/document/create?body={content}` does not work. Google Docs does not support pre-filling document content via URL parameters. This approach was based on outdated documentation that described a feature Google never fully implemented for public use.

### Issue 2: React Warning in Console
There's a ref forwarding warning related to `DropdownMenuContent` that appears when opening the dropdown. While cosmetic, this should be fixed.

## Solution

### For Google Docs Export
Since Google Docs cannot accept pre-filled content via URL without OAuth API integration, the best alternative is a **copy-to-clipboard workflow**:

1. Copy the formatted text to clipboard
2. Open a new blank Google Docs document
3. Show a toast instructing the user to paste

This maintains the low-friction goal while working within Google's limitations.

### For Word Export
The Word export code appears correct. Need to verify the `docx` library is generating content properly. Add error handling and logging to diagnose any issues.

### For React Warning
Add `forwardRef` to the `DropdownMenuContent` component to properly forward refs.

## Implementation Details

### 1. Update export-draft.ts

**Google Docs Export - New Approach:**
```typescript
export function exportToGoogleDocs(draft: CollabDraft, requesterName: string): void {
  const content = formatDraftAsPlainText(draft, requesterName);
  
  // Copy to clipboard first
  navigator.clipboard.writeText(content);
  
  // Open blank Google Docs
  window.open("https://docs.google.com/document/create", "_blank");
}
```

The calling component will show a toast like: "Content copied! Paste it into the new Google Doc (Cmd/Ctrl+V)"

**Word Export - Add Error Handling:**
- Wrap in try/catch
- Add console logging to help diagnose if issues persist

### 2. Update CollabDraftModal.tsx

Update the Google Docs menu item click handler to:
1. Call the export function (which copies to clipboard)
2. Show a more informative toast: "Content copied! Opening Google Docs - paste with Cmd/Ctrl+V"

### 3. Fix DropdownMenu Ref Warning

Update `src/components/ui/dropdown-menu.tsx` to properly forward refs using React.forwardRef on the wrapper components.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/export-draft.ts` | Update `exportToGoogleDocs` to copy-then-open approach; add error handling to `exportToDocx` |
| `src/components/requests/CollabDraftModal.tsx` | Update toast message for Google Docs export |
| `src/components/ui/dropdown-menu.tsx` | Fix ref forwarding warning |

## Testing Checklist

After implementation:
- Generate or view an existing draft
- Click dropdown arrow next to "Copy Draft"
- Test "Download as Word (.docx)" - verify file downloads with content
- Test "Open in Google Docs" - verify clipboard contains content and Google Docs opens
- Paste content into Google Docs to confirm it works
- Verify no React warnings in console

