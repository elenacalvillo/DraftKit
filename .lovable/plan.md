

## Hide Privacy Notice on Authenticated Pages

### Overview
The tracking notice bar currently shows on all pages, including the Dashboard and other authenticated areas. Since users have already accepted the privacy policy during signup, we should hide it on authenticated pages. Users can always access the transparency information via the footer link.

### Implementation Approach

There are two reliable ways to detect if a user is on an authenticated page:
1. **Check if user is logged in** - Use `useAuth()` hook to check for authenticated session
2. **Check route path** - Detect if the current route starts with `/dashboard` or `/admin`

The recommended approach is to use **both** checks for robustness:
- If the user is authenticated (has a session), hide the notice
- Additionally, hide on dashboard/admin routes regardless of loading state

### File to Modify

**`src/components/privacy/TrackingNotice.tsx`**

### Changes Required

1. Import `useAuth` hook from `@/hooks/useAuth`
2. Import `useLocation` from `react-router-dom`
3. Add logic to check if user is authenticated or on a dashboard route
4. Return `null` early if on authenticated pages (before the visibility logic)

### Code Changes

```typescript
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "draftkit_tracking_notice_dismissed";

export function TrackingNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  // Check if on authenticated routes
  const isAuthenticatedRoute = 
    location.pathname.startsWith("/dashboard") || 
    location.pathname.startsWith("/admin");

  useEffect(() => {
    // Don't show on authenticated routes or for logged-in users
    if (user || isAuthenticatedRoute) {
      setIsVisible(false);
      return;
    }

    // Check if notice was already dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user, isAuthenticatedRoute]);

  // Early return if authenticated - don't render anything
  if (user || isAuthenticatedRoute) {
    return null;
  }

  // ... rest of the component unchanged
}
```

### Logic Explanation

| Condition | Notice Behavior |
|-----------|-----------------|
| User logged in | Hidden |
| On `/dashboard/*` route | Hidden |
| On `/admin/*` route | Hidden |
| Public page, not dismissed | Shows after 1s delay |
| Public page, already dismissed | Hidden |

### Why This Approach

- **`useAuth().user`**: Detects authenticated session (covers all logged-in scenarios)
- **Route check**: Provides immediate hiding without waiting for auth state to load
- **Early return `null`**: Prevents even rendering the AnimatePresence wrapper on authenticated pages
- **Preserves localStorage logic**: For unauthenticated visitors who dismissed the notice

