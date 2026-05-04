import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(__dirname, "..");

const read = (file: string) => readFileSync(path.join(uiDir, file), "utf8");

/**
 * These tests guard against regressions for two related fixes:
 *
 * 1. Hover/focus contrast in dropdown-style menu components used to rely on
 *    `bg-accent` + `text-accent-foreground`, which produced an unreadable
 *    orange-on-brown pairing. They were swapped to the high-contrast
 *    `bg-primary` + `text-primary-foreground` pairing.
 * 2. The shared <Select> primitive used to default to Radix' floating
 *    `position="popper"`, which renders the dropdown as a portal-anchored
 *    popup. It now defaults to `position="item-aligned"` so dropdowns are
 *    anchored inline with their trigger.
 */
describe("menu component styling", () => {
  const menuFiles = [
    "dropdown-menu.tsx",
    "select.tsx",
    "context-menu.tsx",
    "menubar.tsx",
    "command.tsx",
    "navigation-menu.tsx",
  ] as const;

  it.each(menuFiles)(
    "%s does not use the low-contrast accent-foreground pairing for hover/focus/selected states",
    (file) => {
      const source = read(file);
      // Ensure no remaining hover/focus/selected/state=open pairings reference
      // the old accent-foreground combo. Standalone usages of accent for other
      // purposes (e.g. translucent backgrounds) are intentionally not checked.
      expect(source).not.toMatch(/focus:bg-accent\b/);
      expect(source).not.toMatch(/focus:text-accent-foreground/);
      expect(source).not.toMatch(/hover:bg-accent\s+hover:text-accent-foreground/);
      expect(source).not.toMatch(/data-\[selected[^\]]*\]:bg-accent/);
      expect(source).not.toMatch(/data-\[state=open\]:text-accent-foreground/);
    },
  );

  it("dropdown-menu, select, context-menu, menubar, and command items use bg-primary/text-primary-foreground for the active state", () => {
    expect(read("dropdown-menu.tsx")).toMatch(/focus:bg-primary focus:text-primary-foreground/);
    expect(read("select.tsx")).toMatch(/focus:bg-primary focus:text-primary-foreground/);
    expect(read("context-menu.tsx")).toMatch(/focus:bg-primary focus:text-primary-foreground/);
    expect(read("menubar.tsx")).toMatch(/focus:bg-primary focus:text-primary-foreground/);
    expect(read("command.tsx")).toMatch(/data-\[selected=true\]:text-primary-foreground/);
    expect(read("navigation-menu.tsx")).toMatch(/hover:bg-primary hover:text-primary-foreground/);
  });
});

describe("SelectContent positioning", () => {
  it("defaults to item-aligned so the dropdown anchors inline with the trigger", () => {
    const source = read("select.tsx");
    // Default value of the `position` prop should be `item-aligned`, not `popper`.
    expect(source).toMatch(/position\s*=\s*"item-aligned"/);
    expect(source).not.toMatch(/position\s*=\s*"popper"/);
  });

  it("still renders popper-only viewport sizing classes behind a position === \"popper\" guard", () => {
    const source = read("select.tsx");
    // The popper-only sizing should remain conditional so consumers that opt
    // back into `position="popper"` continue to get the auto-sized viewport.
    expect(source).toMatch(/position === "popper"/);
    expect(source).toMatch(/--radix-select-trigger-width/);
  });
});
