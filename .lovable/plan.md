

# Google Search Console Domain Verification

## What Google Needs

Google requires a specific HTML file to exist at your site root:
- **URL**: `https://draftkit.app/google5ef7232f709cd511.html`
- **Content**: `google-site-verification: google5ef7232f709cd511.html`

## Implementation

### Step 1: Copy Verification File to Public Folder

Copy the uploaded HTML file to the `public` folder. Files in `public` are served at the root of your site without any processing.

| Source | Destination |
|--------|-------------|
| `user-uploads://Google_Search_Console.html` | `public/google5ef7232f709cd511.html` |

### Step 2: Publish the Site

After the file is added, you need to click **Publish → Update** to deploy the change to your live site at `draftkit.app`.

### Step 3: Verify in Google Search Console

Once published, visit:
```
https://draftkit.app/google5ef7232f709cd511.html
```

If you see the verification text, go back to Google Search Console and click **Verify**.

## Files to Create

| File | Purpose |
|------|---------|
| `public/google5ef7232f709cd511.html` | Google Search Console verification file |

## After Verification

Once verified in Search Console, Google's OAuth review team can confirm you own the domain. This should clear the "Your home page website is not registered to you" blocker in your OAuth consent screen verification.

