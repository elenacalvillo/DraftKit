import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipState {
  comment: string;
  author: string;
  top: number;
  left: number;
}

interface HighlightTooltipProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export function HighlightTooltip({ containerRef }: HighlightTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const show = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    if (!el.classList?.contains("dk-highlight")) return;
    const comment = el.getAttribute("data-comment");
    const author = el.getAttribute("data-author");
    if (!comment) return;
    const rect = el.getBoundingClientRect();
    setTooltip({
      comment,
      author: author || "",
      top: rect.top - 4,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const hide = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    if (el.classList?.contains("dk-highlight")) {
      setTooltip(null);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Use pointerenter/pointerleave to handle both mouse and touch
    container.addEventListener("pointerenter", show, true);
    container.addEventListener("pointerleave", hide, true);
    // Tap support for mobile: toggle on click in view mode
    container.addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      if (!el.classList?.contains("dk-highlight")) return;
      const comment = el.getAttribute("data-comment");
      const author = el.getAttribute("data-author");
      if (!comment) return;
      const rect = el.getBoundingClientRect();
      setTooltip((prev) =>
        prev
          ? null
          : {
              comment,
              author: author || "",
              top: rect.top - 4,
              left: rect.left + rect.width / 2,
            }
      );
    }, true);
    return () => {
      container.removeEventListener("pointerenter", show, true);
      container.removeEventListener("pointerleave", hide, true);
    };
  }, [containerRef, show, hide]);

  if (!tooltip) return null;

  return createPortal(
    <div
      className="fixed z-[120] max-w-xs px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none"
      style={{
        background: "hsl(45 93% 92%)",
        border: "1px solid hsl(45 70% 78%)",
        top: tooltip.top,
        left: tooltip.left,
        transform: "translate(-50%, -100%)",
      }}
    >
      {tooltip.author && (
        <span className="font-semibold text-yellow-800 dark:text-yellow-200 text-xs block mb-0.5">
          {tooltip.author}
        </span>
      )}
      <span className="text-foreground/90">{tooltip.comment}</span>
    </div>,
    document.body
  );
}
