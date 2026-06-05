/**
 * Yield the main thread back to the browser so it can paint, run rAF
 * callbacks, and drain queued messages (including the Lovable preview
 * iframe's postMessage traffic) between heavy synchronous chunks of work.
 */
export function yieldToBrowser(): Promise<void> {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        // Double-rAF + setTimeout ensures a paint cycle has actually occurred
        // before we resume CPU-heavy work.
        window.requestAnimationFrame(() => setTimeout(resolve, 0));
      });
    });
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
