## Fix: Auth Race Condition and Deep-Link Loss

### Root Cause

Every protected page (Dashboard, Requests, Settings, Availability, MyRequests, Workspace) has this pattern:

```
if (!loading && user && !creator) {
  navigate("/signup");  // <-- THIS is the "onboarding flash"
}
```

The problem: `useAuth` sets `user` immediately when the session is found, but `creator` is fetched **asynchronously** afterward. During that gap (a few hundred milliseconds), `user` is truthy but `creator` is still `null` -- so every page briefly redirects to `/signup` (onboarding). Once `creator` loads, Signup detects the existing creator and bounces back to `/dashboard` (losing the original URL).

### The Fix: Centralized ProtectedRoute Component

Instead of each page doing its own auth + creator checks, create a single `ProtectedRoute` wrapper that:

1. Shows a branded loading spinner while `loading` is true **OR** while `user` exists but `creator` hasn't been fetched yet
2. Redirects to `/login` only when auth is definitively resolved and no user exists
3. Redirects to `/signup` only when auth is resolved, user exists, and creator is confirmed missing
4. Preserves the original URL so the user lands exactly where they intended

### Changes

**New file: `src/components/auth/ProtectedRoute.tsx**`

- Accepts `children` (the page content)
- Uses `useAuth()` to get `user`, `creator`, `loading`
- Uses `useLocation()` to capture the current path
- Renders a full-screen branded spinner when auth state is still resolving (`loading === true` or `user && !creator && !creatorChecked`)
- Adds a `creatorLoaded` signal: treat creator as "not yet checked" while `user` exists but `creator` is null and `loading` just turned false. Wait one tick for the creator fetch to complete before deciding.
- Redirects to `/login` (with `state.from = location`) when no user
- Redirects to `/signup` when user exists but creator is definitively null
- Renders `children` when user + creator are confirmed

**Modified file: `src/hooks/useAuth.tsx**`

- Add a `creatorLoading` boolean to the context that is `true` while the creator fetch is in-flight
- Set `creatorLoading = true` before calling `fetchCreator`, set to `false` after it completes
- This eliminates the ambiguous gap where `creator` is null but might still be loading

**Modified file: `src/App.tsx**`

- Import `ProtectedRoute`
- Wrap all dashboard routes with `<ProtectedRoute>`:
  ```
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  ```
- Apply to: `/dashboard`, `/dashboard/availability`, `/dashboard/requests`, `/dashboard/my-requests`, `/dashboard/settings`, `/dashboard/subscription`, `/dashboard/workspace/:requestId`, `/admin/analytics`

**Modified files: Dashboard.tsx, Requests.tsx, Settings.tsx, Availability.tsx, MyRequests.tsx, Workspace.tsx, Subscription.tsx**

- Remove the per-page auth/creator guard `useEffect` blocks (the `navigate("/login")` and `navigate("/signup")` redirects)
- Remove the `if (loading || !creator) return <spinner>` blocks -- `ProtectedRoute` handles this
- Keep all other logic intact

**Modified file: `src/pages/Login.tsx**`

- After successful login, check for `location.state?.from` and navigate there instead of always going to `/dashboard`

### How Deep Links Are Preserved

```
User clicks email link to /dashboard/workspace/abc123
  --> ProtectedRoute shows spinner (loading = true)
  --> Auth resolves, user found, creatorLoading = true (fetching creator)
  --> Creator loaded, creatorLoading = false
  --> ProtectedRoute renders <Workspace /> at /dashboard/workspace/abc123
  --> User sees their workspace immediately. No flash. No redirect.
```

If the user is not logged in:

```
User clicks /dashboard/workspace/abc123
  --> ProtectedRoute detects no user
  --> Redirects to /login with state.from = "/dashboard/workspace/abc123"
  --> User logs in
  --> Login reads state.from, navigates to /dashboard/workspace/abc123
```

&nbsp;

### One Critical Detail to Guard (The "Elena Check")

There is one risk here: **The Admin Role.** You have a specific admin role (`admin/analytics`). Ensure that the new `ProtectedRoute` doesn't accidentally lock you out of admin pages if it's only checking for "Creator" status.

**Tell Lovable this to "Deep-Analyze" and prevent a break:**

> "The plan is approved. It's a great structural fix. One specific requirement:
>
> **Admin Awareness:** In the new `ProtectedRoute.tsx`, ensure it accounts for the `admin` role. If a user has an admin role but perhaps hasn't finished the 'Creator' onboarding for some reason, they should still be able to access the `/admin/analytics` route.
>
> **Branding:** For the loading spinner inside `ProtectedRoute`, please use a subtle, elegant version of our **Venn diagram logo** or the **brand dark (#2A2318)**. It should look like a deliberate 'DraftKit' experience, not a generic white screen."

&nbsp;

### Files Summary


| File                                     | Change                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `src/hooks/useAuth.tsx`                  | Add `creatorLoading` boolean to context                                  |
| `src/components/auth/ProtectedRoute.tsx` | **New** -- centralized auth gate with loading state and URL preservation |
| `src/App.tsx`                            | Wrap protected routes with `ProtectedRoute`                              |
| `src/pages/Dashboard.tsx`                | Remove auth guard useEffect and loading fallback                         |
| `src/pages/Requests.tsx`                 | Remove auth guard useEffect and loading fallback                         |
| `src/pages/Settings.tsx`                 | Remove auth guard useEffect and loading fallback                         |
| `src/pages/Availability.tsx`             | Remove auth guard useEffect and loading fallback                         |
| `src/pages/MyRequests.tsx`               | Remove auth guard useEffect and loading fallback                         |
| `src/pages/Workspace.tsx`                | Remove auth guard useEffect and loading fallback                         |
| `src/pages/Subscription.tsx`             | Remove auth guard useEffect and loading fallback                         |
| `src/pages/Login.tsx`                    | Use `location.state?.from` for post-login redirect                       |
