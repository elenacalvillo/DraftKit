
# Fix Google OAuth Popup Blocked in Preview (ERR_BLOCKED_BY_RESPONSE)

## Problem

Google's OAuth consent page refuses to load inside iframes for security reasons. The Lovable preview environment loads your app in an iframe, causing the `ERR_BLOCKED_BY_RESPONSE` error when the Google Identity Services SDK tries to open its consent popup.

## Solution

Modify the OAuth flow to detect when running inside an iframe and handle it appropriately:

1. **Detect iframe environment** - Check if the app is running inside an iframe
2. **Use `window.open()` with proper targeting** - Force the OAuth flow to open in a new top-level window/tab instead of within the current context
3. **Implement message passing** - After authorization completes in the new window, pass the token back to the parent window to continue the document creation flow

## Technical Implementation

### File: `src/hooks/useGoogleDocs.ts`

**Changes:**
1. Add iframe detection helper
2. Create a dedicated popup window for OAuth when in iframe context
3. Handle the OAuth callback via `postMessage` communication between windows
4. Keep the existing flow for non-iframe environments (production)

**Key code changes:**

```typescript
// Detect if running inside an iframe
const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // Cross-origin iframes throw errors
  }
};

// When requesting the token, explicitly open in a new window
if (isInIframe()) {
  // Use a popup approach that works around iframe restrictions
  const popup = window.open(
    'about:blank',
    'google-oauth-popup',
    'width=500,height=600,scrollbars=yes'
  );
  // The GIS SDK will redirect to this popup
}
```

**Alternative approach - Full page redirect:**
If popups are blocked by the browser, implement a redirect-based flow:
1. Store draft data in localStorage before redirect
2. Redirect to Google OAuth
3. On return, retrieve draft from localStorage and complete document creation

### File: `src/components/requests/CollabDraftModal.tsx`

**Changes:**
- Add user feedback when OAuth is blocked
- Show clear messaging about opening in a new tab/window
- Add a "Try in new tab" fallback button if popup fails

## Verification Steps

1. Open the preview in Lovable
2. Navigate to a collab request with a generated draft
3. Click "Open in Google Docs" from the dropdown
4. A new browser tab/window should open with Google's consent screen
5. After granting permission, the Google Doc should be created with content

## Fallback Behavior

If the popup/redirect approach still fails (e.g., aggressive popup blockers):
- The existing fallback (copy to clipboard + open blank doc) remains available
- User sees a helpful toast message explaining what happened
