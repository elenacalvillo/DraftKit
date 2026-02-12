

# Workspace Overhaul: Typography + Card Reorder

Two files changed, zero new dependencies.

## 1. Typography Kill-Switch (sans-serif everywhere)

Remove all serif/Georgia references from the editor and workspace. Switch to the app's primary font (Inter).

**File: `src/components/requests/WorkspaceEditor.tsx`** (line 56-57)
- Change `font-serif` to `font-sans` in editor class
- Remove the inline `style` that sets Georgia/serif
- Set `line-height: 1.6` for premium readability

**File: `src/components/requests/SharedWorkspace.tsx`** (line 243-244)
- Remove the inline `style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}` from the read-only content view

**File: `src/index.css`** (workspace-prose styles)
- No structural changes needed -- the prose styles already inherit from `--foreground` and don't force a serif font

## 2. Reorder the Approved Card (Progressive Disclosure)

Current order in `RequestCard.tsx` (lines 396-489):
1. Draft button + Message + Cancel (row)
2. "Enter Workspace" button
3. External link input

New order:
1. Draft snippet (already exists at lines 357-371, stays)
2. External link input (moved up)
3. "Start Drafting" button (renamed, moved to bottom, full-width)
4. Draft button + Message + Cancel row stays above the link

**File: `src/components/requests/RequestCard.tsx`** (lines 394-489)
- Move the collaboration link section **above** the "Start Drafting" button
- Rename "Enter Workspace" to "Start Drafting"
- Keep the button `variant="gradient"` and `className="w-full"` (already full-width)
- The action row (View Draft, Message, Cancel) stays at the top of the approved section

### Final card layout for approved requests:

```text
[Draft snippet preview]          -- the hook
[View Draft] [Message] [Cancel]  -- secondary actions
[External doc link input]        -- the resource
[======= Start Drafting =======] -- the primary CTA
```

