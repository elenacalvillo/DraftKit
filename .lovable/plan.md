

# Center Floating Pill to the Drafting Area

## Problem

The pill toolbar is currently centered to the full viewport (`left-1/2 -translate-x-1/2`), but the drafting area only occupies the right column of a `[280px_1fr]` grid. This makes the pill appear shifted left relative to where the user is actually writing.

## Solution

Use a `ref` on the editor's container element and track its horizontal bounds (left edge + width) via `ResizeObserver`. Apply those values as inline `left` and `width` styles on the fixed pill, replacing the viewport-center approach.

## Changes: `WorkspaceEditor.tsx` only

### 1. Add a container ref + bounding state

- Add a `ref` to the outermost `<div>` wrapping the editor
- Use a `useEffect` with `ResizeObserver` + `scroll` listener to track the container's `getBoundingClientRect().left` and `width`
- Store these in state: `{ left: number; width: number } | null`

### 2. Update the pill's positioning

Replace:
```
className="fixed bottom-8 left-1/2 -translate-x-1/2 ..."
```

With:
```
style={{ left: bounds.left + bounds.width / 2, transform: 'translateX(-50%)' }}
className="fixed bottom-8 z-[100] ..."
```

This keeps the pill `fixed` (viewport-pinned, never scrolls away) but horizontally aligned to the editor column center.

### 3. Fallback for mobile / no bounds

If `bounds` is null (e.g., SSR or initial render), fall back to the current `left-1/2 -translate-x-1/2` centering. On mobile where the sidebar collapses and the editor spans the full width, the pill naturally centers to the screen since the editor IS the full width.

### Implementation sketch

```typescript
const containerRef = useRef<HTMLDivElement>(null);
const [bounds, setBounds] = useState<{ left: number; width: number } | null>(null);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const update = () => {
    const rect = el.getBoundingClientRect();
    setBounds({ left: rect.left, width: rect.width });
  };
  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  window.addEventListener('scroll', update, true);
  return () => { ro.disconnect(); window.removeEventListener('scroll', update, true); };
}, []);
```

The pill div then uses:
```typescript
style={bounds ? {
  left: bounds.left + bounds.width / 2,
  transform: 'translateX(-50%)',
} : {
  left: '50%',
  transform: 'translateX(-50%)',
}}
```

No other files change. The pill remains portaled to `document.body` and fully independent of overflow/scroll, just now horizontally anchored to the correct column.

