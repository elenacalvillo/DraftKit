# Add Draft Management & Collaboration Link Features

## Status: ✅ COMPLETE

## Overview

This feature addresses Dinah's feedback about wanting more control over collaboration workflows. Creators can now delete AI drafts and link to external documents (like Google Docs) for the actual collaborative work.

## Features Implemented

### 1. Delete Draft Button ✅
Creators can clear the AI-generated draft and return to the "Generate Draft" state.

### 2. Collaboration Link Field ✅
Creators can paste a URL to their shared working document (e.g., Google Doc, Notion page).

### 3. Open Shared Document Button ✅
When a collab_link exists, both creator and guest can quickly access the shared workspace.

---

## Changes Made

| File | Change |
|------|--------|
| Database | Added `collab_link` column via migration |
| `src/hooks/useAnalytics.ts` | Added `draft_deleted` event type |
| `src/components/requests/CollabDraftModal.tsx` | Added `onDelete` prop and "Delete Draft" button |
| `src/components/requests/RequestCard.tsx` | Added collab link input, save handler, delete draft handler, and display logic |
| `src/pages/MyRequests.tsx` | Shows "Open Shared Document" button for guests when link exists |
