

# Fix Google OAuth Redirect URI Mismatch

## The Problem
The error `Error 400: redirect_uri_mismatch` means Google OAuth is rejecting the login request because the redirect URI being sent (`https://collabstack.lovable.app`) isn't in the list of authorized redirect URIs.

## Root Cause
This is a **configuration issue**, not a code bug. The Google OAuth settings need to include your published domain as an authorized redirect URI.

## Solution

### For Lovable Cloud Managed OAuth (Current Setup)
Since this project uses Lovable Cloud's managed OAuth system, you need to ensure your published domain is properly configured:

1. **Open your backend settings** in Lovable Cloud
2. Navigate to **Users → Authentication Settings → Sign In Methods → Google**
3. Verify that your custom domain (`collabstack.lovable.app`) is included in the authorized redirect URIs

If you're using your own Google OAuth credentials (BYOK):
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   - `https://collabstack.lovable.app` (your published domain)
   - The callback URL from Lovable Cloud's Authentication Settings for Google

## No Code Changes Required
The current implementation is correct:
```typescript
const signInWithGoogle = async () => {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,  // ✓ Correctly uses current origin
  });
  // ...
};
```

## Next Steps
To fix this, open your backend dashboard and check the Google OAuth configuration:

