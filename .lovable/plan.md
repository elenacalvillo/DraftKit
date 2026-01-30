
# Fix Google Docs OAuth - Client ID Not Available to Frontend

## Problem Identified

The `VITE_GOOGLE_OAUTH_CLIENT_ID` is stored as a backend secret, but Vite environment variables must be in the `.env` file to be available during the frontend build. Currently:

1. The hook reads `import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID`
2. This returns `undefined` (not in `.env`)
3. The OAuth flow is skipped with "Google OAuth is not configured"
4. Falls back to copy-paste method
5. Blank document opens

## Why This Is Safe

Google OAuth Client IDs are **public/publishable keys**. They are:
- Designed to be visible in browser code
- Protected by authorized JavaScript origins in Google Cloud Console
- Already visible to any user who inspects your page source

This is different from the Client Secret, which must stay on the backend.

## Solution

Add the Google OAuth Client ID to the `.env` file so Vite can inject it during the build.

## Implementation

### File: `.env`

Add the `VITE_GOOGLE_OAUTH_CLIENT_ID` line with your actual Client ID from Google Cloud Console:

```
VITE_SUPABASE_PROJECT_ID="cbgchxesngdsvkevbqwh"
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_SUPABASE_URL="https://cbgchxesngdsvkevbqwh.supabase.co"
VITE_GOOGLE_OAUTH_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
```

### Required Information

You will need to provide your Google OAuth Client ID. You can find this in:
1. Google Cloud Console
2. APIs & Services
3. Credentials
4. Your OAuth 2.0 Client ID

The format is: `XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com`

## Verification Checklist

After adding the Client ID:
1. The preview will rebuild with the new env variable
2. Click "Open in Google Docs" on a draft
3. A Google OAuth popup should appear asking for permission
4. After granting access, the doc should open WITH content pre-filled
