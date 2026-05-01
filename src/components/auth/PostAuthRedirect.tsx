import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Restores the intended destination after a redirect-based auth flow
 * (e.g. Google OAuth). Before initiating OAuth we stash `from` in
 * sessionStorage; once the session is back we consume it and navigate.
 *
 * Only runs on routes where being bounced to a workspace makes sense
 * (i.e. NOT while the user is mid-flow on /signup or /reset-password).
 */
export function PostAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;

    // Don't yank users out of an active onboarding/reset flow.
    const path = location.pathname;
    if (
      path.startsWith("/signup") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/forgot-password")
    ) {
      return;
    }

    let target: string | null = null;
    try {
      target = sessionStorage.getItem("postAuthRedirect");
    } catch {
      target = null;
    }
    if (!target) return;

    try { sessionStorage.removeItem("postAuthRedirect"); } catch {}

    // Only honour internal paths.
    if (target.startsWith("/") && target !== path) {
      navigate(target, { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  return null;
}
