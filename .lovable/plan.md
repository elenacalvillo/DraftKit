

# In-Workspace Conversation Feed (Pro Feature)

## What this adds

A chronological message thread embedded directly in the workspace sidebar, below the "Message" button. Pro users see the full conversation history in-context. Free users see a teaser with an upgrade prompt.

## Changes

### 1. New component: `WorkspaceConversation.tsx`

A sidebar-friendly conversation feed component that:
- Fetches all `collaboration_messages` for the given `request_id`, ordered by `created_at`
- Displays messages in a compact bubble/thread style (sender name, time, content)
- Visually distinguishes "creator" vs "requester" messages (left/right alignment or color)
- Auto-scrolls to the latest message
- Fits within the 280px sidebar width
- Shows a subtle empty state when no messages exist yet ("No messages yet. Start the conversation!")

### 2. Update `Workspace.tsx` sidebar

- Import `usePro` hook and the new `WorkspaceConversation` component
- Below the "Message [Partner]" button and action buttons section, add the conversation feed
- **Pro gate logic:**
  - If `isPro`: render `WorkspaceConversation` with full history
  - If not Pro: show a teaser (e.g., the 1-2 most recent messages blurred or a locked state) with an `UpgradePrompt` using a new `'workspace'` feature type
- After a message is sent via the modal, refresh the conversation feed (pass a `refreshKey` or use `react-query` invalidation)

### 3. Update `UpgradePrompt.tsx`

- Add a new `'workspace'` feature type to the `FeatureType` union and `FEATURE_COPY` map:
  - Title: "Workspace Conversation History"
  - Description: "Keep your collaboration context in one place"
  - Icon: `MessageSquare`

### 4. Refresh after sending a message

- In both `SendMessageModal` and `GuestMessageModal`, after a successful send, call an `onMessageSent` callback prop
- In `Workspace.tsx`, pass `onMessageSent` that increments a counter or invalidates the conversation query, so the feed updates immediately

## Visual layout (sidebar)

```text
+---------------------------+
|  [Avatar] Partner Name    |
|  substack link            |
|  Badge: Collab Type       |
|  Date / Email             |
+---------------------------+
|  "Original Message"       |
+---------------------------+
|  [Generate AI Draft]      |
|  [Message Partner]        |
|  [Open External Doc]      |
+---------------------------+
|  CONVERSATION             |
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|  You (2h ago):            |
|  "Hey, excited to..."     |
|                           |
|  Partner (1h ago):        |
|  "Me too! Let's..."       |
|                           |
|  (auto-scroll to bottom)  |
+---------------------------+
```

## Technical details

| File | Change |
|------|--------|
| `src/components/requests/WorkspaceConversation.tsx` | **New** -- fetches and renders message thread for a request |
| `src/pages/Workspace.tsx` | Import `usePro`, add conversation feed to sidebar with Pro gate |
| `src/components/subscription/UpgradePrompt.tsx` | Add `'workspace'` feature type |
| `src/components/requests/SendMessageModal.tsx` | Add optional `onMessageSent` callback |
| `src/components/requests/GuestMessageModal.tsx` | Add optional `onMessageSent` callback |

No database changes needed -- `collaboration_messages` table and RLS policies already exist.
