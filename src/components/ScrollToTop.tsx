import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll position to top on every route change.
 * Eliminates "land mid-page then content jumps" perceived hiccup.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
