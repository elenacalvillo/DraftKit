

# Add Privacy Policy Page for Google OAuth Verification

## Why This Is Needed

Google requires a formal Privacy Policy page for OAuth app verification. The existing `/transparency` page is great for explaining your privacy philosophy, but Google's verification process specifically looks for a privacy policy that covers:

- What data is collected
- How data is used
- Third-party services used
- User rights (access, deletion)
- Contact information
- Last updated date

## Implementation

### 1. Create Privacy Policy Page

**New file: `src/pages/PrivacyPolicy.tsx`**

A formal but still on-brand privacy policy page that covers all required sections:

| Section | Content |
|---------|---------|
| Information We Collect | Account info, public newsletter data, collaboration requests, usage analytics |
| How We Use Your Information | Provide services, improve features, communication |
| Third-Party Services | Google APIs (Docs export), analytics tools |
| Data Security | RLS, encryption, secure authentication |
| Your Rights | Access, correction, deletion requests |
| Google API Disclosure | Required disclosure about limited use of Google data |
| Contact | hello@draftkit.app |
| Updates | Last updated date, notification policy |

The page will follow the same design pattern as Transparency (Navbar, motion animations, glass-card sections) to maintain brand consistency.

### 2. Add Route

**File: `src/App.tsx`**

Add new route:
```typescript
<Route path="/privacy" element={<PrivacyPolicy />} />
```

### 3. Update Footer

**File: `src/components/layout/Footer.tsx`**

Add a "Privacy Policy" link next to the existing "How we protect you" link:
```typescript
<Link to="/privacy">Privacy Policy</Link>
<Link to="/transparency">How we protect you</Link>
```

### 4. Cross-Link Between Pages

- Add a link from Privacy Policy to Transparency for the human-readable version
- Add a link from Transparency to Privacy Policy for the formal legal version

## Google-Required Disclosures

For Google API verification, the Privacy Policy must include specific language about:

1. **Limited Use Disclosure**: "DraftKit's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements."

2. **Scope Explanation**: Explain that the app only accesses Google Docs to create documents with user-initiated content, and does not store or access other Google data.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/PrivacyPolicy.tsx` | Create new page |
| `src/App.tsx` | Add route |
| `src/components/layout/Footer.tsx` | Add link |

## After Implementation

Once the Privacy Policy page is live at `https://draftkit.app/privacy`:

1. Go to Google Cloud Console > APIs & Services > OAuth consent screen
2. Add the Privacy Policy URL: `https://draftkit.app/privacy`
3. Submit for verification review

