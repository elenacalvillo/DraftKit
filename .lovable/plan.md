

# Google Docs Direct Export - Full OAuth Integration

Enable creators to export drafts directly to Google Docs with content pre-filled, eliminating the copy-paste step.

## What Will Be Built

A seamless "Export to Google Docs" feature that:
1. Prompts user to authorize with Google (one-time)
2. Creates a new Google Doc with the draft content already inside
3. Opens the document for editing

## How It Works

```text
User clicks "Open in Google Docs"
            |
            v
   +------------------+
   | First time only: |
   | Google OAuth     |
   | popup appears    |
   +------------------+
            |
            v
   +------------------+
   | Backend creates  |
   | document via     |
   | Google Docs API  |
   +------------------+
            |
            v
   +------------------+
   | Browser opens    |
   | the new doc      |
   | WITH content     |
   +------------------+
```

## Architecture

The implementation uses Google Identity Services (GIS) for modern OAuth 2.0 flow:

**Frontend (Browser)**
- Load Google Identity Services SDK
- Request OAuth token with `https://www.googleapis.com/auth/documents` scope
- Send token + draft content to backend function

**Backend (Edge Function)**
- Receive OAuth token and draft content
- Call Google Docs API to create document
- Insert formatted text into document
- Return document URL to frontend

**Frontend (cont.)**
- Open returned Google Doc URL in new tab
- Store OAuth refresh token for future exports (optional enhancement)

## Setup Requirements

This feature requires a Google Cloud project with OAuth credentials. You will need to:

1. Create a Google Cloud Project (free)
2. Enable the Google Docs API
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized JavaScript origins for your domain

## Implementation Details

### 1. Create Backend Function

New file: `supabase/functions/create-google-doc/index.ts`

This function:
- Receives the user's OAuth access token and draft content
- Creates a new Google Doc via the API
- Inserts the formatted draft content
- Returns the document URL

### 2. Add Google Identity Services to Frontend

Update `index.html` to load the GIS SDK:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 3. Create Google OAuth Hook

New file: `src/hooks/useGoogleDocs.ts`

Provides:
- `requestGoogleAuth()` - Triggers OAuth popup
- `createGoogleDoc(draft)` - Creates doc with content
- `isAuthorized` - Whether user has granted access

### 4. Update Export Function

Modify `src/lib/export-draft.ts`:
- Keep existing Word export unchanged
- Update `exportToGoogleDocs` to use OAuth flow
- Fall back to copy-paste if OAuth fails/denied

### 5. Update Modal UI

Modify `src/components/requests/CollabDraftModal.tsx`:
- Show loading state during OAuth/creation
- Handle authorization errors gracefully
- Open the created document

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/create-google-doc/index.ts` | Create | Backend API for Google Docs creation |
| `index.html` | Modify | Add GIS script tag |
| `src/hooks/useGoogleDocs.ts` | Create | Google OAuth + Docs API hook |
| `src/lib/export-draft.ts` | Modify | Integrate new OAuth flow |
| `src/components/requests/CollabDraftModal.tsx` | Modify | Handle loading/error states |

## Google Cloud Setup (User Action Required)

Before implementation, you need to set up Google Cloud credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google Docs API" in APIs & Services
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Application type: Web application
6. Add Authorized JavaScript origins:
   - `https://collabstack.lovable.app` (production)
   - Your preview URL for testing
7. Copy the Client ID

After setup, I'll need the **Google OAuth Client ID** to complete the implementation.

## Security Considerations

- OAuth tokens are short-lived and scoped to only document creation
- No tokens are stored on our backend - only passed through
- Users can revoke access anytime via Google Account settings
- The backend function validates the token before using it

## Alternative: Fallback Behavior

If a user declines OAuth or something fails:
- Show a toast explaining they can still copy-paste
- Fall back to the current copy-to-clipboard + open blank doc behavior
- This ensures the feature always works, just with varying convenience

