## Plan: Project dashboard clarity pass

All changes live in `src/pages/ProjectDetail.tsx`. No logic, schema, or backend changes.

### 1. Rename "Writer's Room" → "Broadcasts"

- Update the `TabsTrigger value="broadcast"` label from "Writer's Room" to "Broadcasts".
- Swap the current icon for `Megaphone` (from lucide-react) for a clearer one-way-announcement metaphor.
- Update incidental copy on the broadcast panel: the textarea placeholder ("Quick update for the writers' room…") becomes "Share an update with everyone on this project…", and the card heading stays "Send a message to all project members".

### 2. Per-tab header guide (muted helper text under the TabsList)

Render a small muted paragraph inside each `TabsContent`, directly above its existing content. Style: `text-sm text-muted-foreground mb-4`.

- **Chapters:** "Manage and organize your manuscript structure. Changing a chapter's workflow state updates its status for your team — your content is always safely preserved and never lost."
- **Members:** "Manage project access. Invite editors, co-authors, or beta readers and assign roles to control who can view or edit your manuscript."
- **Broadcasts:** "Send important updates or announcements to everyone participating in this book project. Past broadcasts will appear in your history below."

### 3. Workflow-state reassurance strip (Chapters tab only)

Directly above the first chapter row (and above the "Add chapter" button row, inside the Chapters tab), add a single-line inline notice:

- **Placement:** Put this notice in its own independent row at the very top of the tab content, completely above the "Add chapter" button row, using `w-full mb-4`.
- Icon: `Info` (lucide), muted foreground.
- Copy: "Workflow States are just progress labels. Your text stays fully intact, editable, and backed up across every transition."
- Style: subtle rounded border, `bg-muted/40 border-border text-xs text-muted-foreground px-3 py-2 flex items-center gap-2`. Not dismissible — it's short and contextual.

### Out of scope

- No changes to chapter status enum, broadcast backend, or member roles.
- No tooltips on the status dropdown itself (the strip above the list covers the same fear without per-row noise).
- No new dependencies.