import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAnalytics } from "@/hooks/useAnalytics";

/**
 * Fires a single `page_view` analytics event each time the route changes.
 * Mounted once globally so we get baseline funnel coverage without having
 * to remember it page-by-page.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (lastPath.current === path) return;
    lastPath.current = path;
    trackEvent("page_view", { path });
  }, [location.pathname, trackEvent]);

  return null;
}
