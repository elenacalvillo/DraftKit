

# Export to Docs - Quick Win Feature

Enable creators to export their collaboration drafts directly to Google Docs or as a downloadable Word document, fitting seamlessly into Substackers' "final polish" workflow.

## What Will Be Built

An "Export to Docs" button in the SMART Draft Workspace modal that offers two export options:

1. **Download as Word (.docx)** - Instant download for offline editing
2. **Open in Google Docs** - One-click export to Google Docs (no API key required)

## Why This Approach

| Approach | Pros | Cons |
|----------|------|------|
| **Google Docs via URL (chosen)** | No OAuth setup, instant, works everywhere | Opens as new doc (no folder selection) |
| Google Drive API | Full control, choose folder | Requires OAuth, complex setup |
| **docx.js library (chosen)** | Client-side, no backend needed, real .docx | Adds ~80KB to bundle |
| Plain text download | Zero dependencies | No formatting preserved |

The chosen approach balances simplicity with professional output - no API keys, no OAuth dance, just click and go.

## User Flow

```text
User clicks "Generate Draft" or "View Draft"
             |
             v
    +-------------------+
    |  Draft Modal      |
    |  opens with       |
    |  draft content    |
    +-------------------+
             |
             v
    User clicks dropdown arrow next to "Copy Draft"
             |
             v
    +-------------------+
    | Export Options    |
    | - Copy Draft      |
    | - Download .docx  |
    | - Open in Docs    |
    +-------------------+
             |
    +--------+---------+
    |                  |
    v                  v
Download .docx    Opens Google Docs
   file          with draft content
```

## Implementation Details

### 1. Add docx Library
Install `docx` package for generating Word documents client-side. This is a mature, well-maintained library specifically designed for creating .docx files in JavaScript.

### 2. Create Export Utility
New file: `src/lib/export-draft.ts`

Provides two export functions:
- `exportToDocx(draft, requesterName)` - Generates and downloads a formatted .docx file
- `exportToGoogleDocs(draft, requesterName)` - Opens Google Docs with pre-filled content

The Word document will include:
- Title as Heading 1
- Metadata (format, estimated read time)
- Opening hook in a styled block
- Numbered outline sections with contributor badges
- Talking points as bullet list
- Tone notes section

### 3. Update CollabDraftModal
Modify: `src/components/requests/CollabDraftModal.tsx`

Replace the single "Copy Draft" button with a split button dropdown:
- Primary action: Copy Draft (existing behavior)
- Dropdown menu:
  - Download as Word Document (.docx)
  - Open in Google Docs

### 4. Analytics Tracking
Track export events to understand usage:
- `draft_exported_docx` - When user downloads Word file
- `draft_exported_google_docs` - When user opens in Google Docs

## Technical Notes

### Google Docs Export (No API Required)
Uses the URL scheme: `https://docs.google.com/document/create?body={encoded_content}`

This opens a new Google Doc with the content pre-filled. The user must be logged into Google, but no OAuth or API keys are needed.

**Limitation**: Content is plain text (no formatting preserved). For formatted exports, users should use the Word download option.

### Word Document Generation
Uses the `docx` npm package to generate proper Office Open XML documents:

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: draft.title, bold: true })]
      }),
      // ... more content
    ]
  }]
});

const blob = await Packer.toBlob(doc);
saveAs(blob, `${draft.title}.docx`);
```

### File Naming
Documents are named using the draft title, sanitized for filesystem compatibility:
- `"Creator × Guest: Topic Ideas"` becomes `"Creator × Guest - Topic Ideas.docx"`

### Files Changed

**New Files:**
- `src/lib/export-draft.ts` - Export utility functions

**Modified Files:**
- `src/components/requests/CollabDraftModal.tsx` - Add export dropdown
- `package.json` - Add `docx` and `file-saver` dependencies

### Bundle Impact
- `docx`: ~80KB gzipped (tree-shakeable)
- `file-saver`: ~3KB gzipped
- Total impact: ~83KB (acceptable for the value provided)

