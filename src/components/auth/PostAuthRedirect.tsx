import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  readAttribution,
  markAttributionEmitted,
  wasAttributionEmitted,
} from "@/lib/attribution";

/**
 * Restores the intended destination after a redirect-based auth flow
 * (e.g. Google OAuth). Before initiating OAuth we stash `from` in
 * sessionStorage; once the session is back we consume it and navigate.
 *
 * Also emits `signup_attribution` once per session for OAuth signups
 * — the email/password path emits it inside Signup.tsx itself.
 *
 * Only runs on routes where being bounced to a workspace makes sense
 * (i.e. NOT while the user is mid-flow on /signup or /reset-password).
 */
export function PostAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    if (loading || !user) return;

    // Best-effort: if this is the first auth on this tab and we have
    // captured attribution that hasn't been emitted yet, emit it.
    // This catches Google OAuth signups originating from a public
    // booking page (?ref=, ?invited_by=, ?utm_source=email, ...).
    if (!wasAttributionEmitted()) {
      const attr = readAttribution();
      if (attr) {
        trackEvent("signup_attribution", {
          source: attr.source,
          ref_username: attr.ref_username,
          invite_request_id: attr.invite_request_id,
          utm_source: attr.utm_source,
          utm_medium: attr.utm_medium,
          utm_campaign: attr.utm_campaign,
          via: "oauth_post_auth",
        });
        markAttributionEmitted();
      }
    }

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
  }, [user, loading, location.pathname, navigate, trackEvent]);

  return null;
}
