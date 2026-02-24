## Contextual Card Redesign for RequestCard

### Goal

Transform the approved-state card from a "cockpit of buttons" into a clean, single-action workspace card using progressive disclosure.

### Changes (all in `src/components/requests/RequestCard.tsx`)

#### 1. Add a three-dot overflow menu (using DropdownMenu)

Move low-frequency actions into a `...` menu in the card header (top-right, next to the status badge):

- "Message" (opens SendMessageModal)
- "Link External Doc" (toggles the link input inline)
- "View SMART Draft" / "Generate SMART Draft" (conditionally labeled)
- Separator
- "Change Collab Type" (if approved)
- "Cancel Collaboration" (destructive, if approved)

#### 2. Rename all "AI" references to "SMART"

- "View AI Draft" becomes "View SMART Draft"
- "Generate Draft" becomes "Generate SMART Draft"
- "Draft Ready" label becomes "SMART Draft Ready"

#### 3. Collapse the External Doc Link input

Remove the always-visible input box (lines 480-531). Instead:

- If a link exists, show a small inline text link "External Doc" with an external-link icon (not a full button row).
- The input only appears when triggered from the overflow menu's "Link External Doc" action.

#### 4. Simplify the approved-state footer

Replace the current 4-button row + input + primary button with:

- One primary gradient button: "Start Drafting" or "Continue Drafting" (already exists, just remove clutter above it).
- A small secondary row: if a SMART draft exists, show a subtle "SMART Draft ready" text indicator (clickable to view). No standalone buttons.

#### 5. Header cleanup

- Move the status badge into a small dot/icon next to the name instead of the large pill (keep pill for pending/declined/cancelled, use subtle indicator for approved).
- Keep the collab type as a small tag, remove the inline edit button (moved to overflow menu).

#### 6. Email row cleanup

- Keep the email link but remove the copy button from always-visible; move copy to the overflow menu or keep as a tiny icon.

### Visual Result (Approved Card)

```text
+------------------------------------------+
| [Avatar] Name              [...] [badge] |
|          substack.com/name               |
|                                          |
| Calendar icon  Requested: Mon, Mar 3     |
| Sparkles icon  Virtual Coffee            |
|                                          |
| "Their message here..."                  |
|                                          |
| SMART Draft ready (clickable)            |
| External Doc (small link, if set)        |
|                                          |
| [====== Continue Drafting ======]  (orange)|
+------------------------------------------+
```

### Technical Details

**New import**: `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger` from `@/components/ui/dropdown-menu`, plus `MoreHorizontal` from `lucide-react`.

**State changes**:

- `isEditingLink` now toggled from overflow menu instead of inline edit button.
- `isEditingCollabType` toggled from overflow menu.

**Lines affected** (approximate):

- Lines 230-278 (header): add overflow menu trigger, simplify status badge for approved state
- Lines 280-375 (details): remove standalone email copy button row, keep calendar + collab type compact
- Lines 384-398 (draft preview): make clickable, rename to "SMART Draft Ready"
- Lines 448-543 (approved actions): remove the 3-button row and external doc input; keep only the primary CTA button; add subtle draft/link indicators
- Import line (line 4): add `MoreHorizontal`, add dropdown imports

**No backend changes needed.** This is purely a frontend UI refactor.

&nbsp;

### 1. The "Mental Wireframe"

Here is how the card will be structured to avoid the "cockpit" look:

- **Top Right:** The only thing next to the name is the `...` (More) menu and a tiny **Status Dot** (Green for Approved).
- **The "Contextual" Row:** Right above the orange button, there will be a single line of text.
  - *If no draft:* (Empty space or "Ready to start?")
  - *If draft exists:* "✨ **SMART Draft ready**" (Clickable text).
- **The Action:** A single, full-width **Orange Button**.

---

### 2. How to "Safety Check" before clicking Accept

When Lovable generates the code, **DO NOT click "Accept" immediately.** Instead, use the **Preview Window** and perform these three "Stress Tests":

1. **The "Shrink" Test:** Resize the preview to a narrow mobile view. If the `...` menu overlaps the name or the "SMART Draft" text wraps weirdly, tell Lovable: *"The header is overlapping on mobile, please fix the flex-wrap."*
2. **The Dropdown Test:** Click the `...` menu. Does "Generate SMART Draft" actually work from inside a menu? If not, the logic might be disconnected.
3. **The "Empty State" Test:** If you have a request with NO manual content and NO draft, make sure the card doesn't look "broken" or "too empty." It should still feel like a clean invitation to work.

---

### 3. Add this "Confidence Clause" to the instructions:

Paste this at the very bottom of your plan to ensure the CSS is tight:

> **"Styling Requirement:** The `RequestCard` must use a strict Flexbox layout. Ensure the 'Continue Drafting' button is always anchored at the bottom. The overflow menu (`...`) must be aligned to the top-right with enough padding to be a clear touch target on mobile (min 44x44px). If `shared_content` exists, ensure the 'SMART Draft' text is rendered in a muted brand color so it doesn't compete with the primary orange button."

