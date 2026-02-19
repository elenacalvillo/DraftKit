
# "Published" Status — Closing the Collaboration Loop

## What's Being Added

A new `published` status lifecycle stage for collaboration requests. When a creator answers "Yes" to the "Was this published?" check-in inside the workspace, the request status automatically upgrades from `approved` to `published`. A new "Published" filter tab in the Requests dashboard surfaces these as a dedicated "wins" archive.

No database schema migration is needed — the `status` column in `collab_requests` is a free-text field with no enum constraint.

---

## The Three-Part Change

### Part 1 — Workspace Banner Triggers Status Update (`Workspace.tsx`)

Currently `handlePublishAnswer("yes")` only writes to `user_feedback`. It needs to also update the request's `collab_requests.status` to `'published'`.

The RLS policy `Creators can update own requests` already permits this since `creator_id` maps to the creator's own record. For guests, there is also a `Requesters can edit shared workspace` policy — however this only allows setting `status = 'approved'`. We need to also allow guests to set `status = 'published'` — but actually, only the **host creator** should mark it published. The workspace banner is shown to both parties, so we'll restrict the status update to when `isCreator === true`. The guest can still record their `user_feedback` answer, but only the host's "Yes" flips the canonical status.

```tsx
// In handlePublishAnswer, add after the user_feedback insert:
if (answer === "yes" && isCreator && requestId) {
  await supabase
    .from("collab_requests")
    .update({ status: "published" })
    .eq("id", requestId);
  
  setRequest(prev => prev ? { ...prev, status: "published" } : prev);
}
```

This means clicking "Yes" in the banner now:
1. Writes to `user_feedback` (existing)
2. Updates `collab_requests.status` to `'published'` (new)

**RLS check:** The `Creators can update own requests` policy has no `WITH CHECK` clause — it only checks `USING (creator_id IN (...WHERE user_id = auth.uid()))`. The update from `approved` → `published` is a valid text value and will pass through. No migration needed.

---

### Part 2 — Requests Dashboard Filter Tab (`Requests.tsx`)

**FilterTab type:** Add `"published"` to the union type.

**Tab list:** Add a "Published" tab with a trophy or star icon next to the label.

**filteredRequests logic:** The existing `r.status === activeTab` comparison already works — `"published"` will match correctly.

**Tab badge count:**
```tsx
{ value: "published", label: "Published", count: requests.filter(r => r.status === "published").length }
```

**"All" tab:** Published requests are already included since `activeTab === "all"` returns all records.

**Status mapping in `mappedRequests`:** The type cast `r.status as 'pending' | 'approved' | 'declined' | 'cancelled'` needs `| 'published'` added.

---

### Part 3 — RequestCard Published UI (`RequestCard.tsx`)

**Status color:** Add `published` to `statusColors`:
```tsx
published: "bg-success/15 text-success border-success/30",
```

**Badge label:** The `{request.status}` text renders "published" — but we should capitalize it and add an emoji for delight: change the display to use a lookup:
```tsx
const statusLabels: Record<string, string> = {
  published: "✨ Published",
  approved: "Approved",
  ...
};
```

**Published action block:** For `status === "published"`, replace the approved block entirely with a clean archive view — similar to the past-collab archive view already in place, but with a more celebratory tone:

```tsx
{request.status === "published" && (
  <div className="space-y-3 pt-3 border-t mt-3">
    <div className="flex items-center gap-2 text-sm text-success font-medium">
      <Sparkles className="w-4 h-4" />
      <span>This collaboration is published!</span>
    </div>
    <Button
      variant="outline"
      className="w-full border-success/30 text-success hover:bg-success/10"
      onClick={() => navigate(`/dashboard/workspace/${request.id}`)}
    >
      <ExternalLink className="w-4 h-4 mr-2" />
      View Final Workspace
    </Button>
  </div>
)}
```

No "Generate Draft", no "Cancel", no "Message" — just a clean link to the workspace.

---

### Part 4 — Guest Side: `MyRequests.tsx`

The `statusVariants` map in `MyRequests.tsx` needs `published` added:
```tsx
published: { label: '✨ Published', variant: 'default' },
```

The existing `approved` action block (with "Enter Workspace") already handles the workspace link — since status is now `published` instead of `approved`, we need `published` to also render the workspace button. The simplest fix is to check `request.status === 'approved' || request.status === 'published'` for the workspace section, with a slight label change for published state ("View Published Work" instead of "Enter Workspace").

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Workspace.tsx` | In `handlePublishAnswer`, after `user_feedback` insert, update `collab_requests.status = 'published'` when `answer === "yes" && isCreator` |
| `src/pages/Requests.tsx` | Add `"published"` to `FilterTab` type; add Published tab to tabs array; update type cast in `mappedRequests` |
| `src/components/requests/RequestCard.tsx` | Add `published` status color + display label; add published-specific card action block |
| `src/pages/MyRequests.tsx` | Add `published` to `statusVariants`; extend workspace button to show for `published` status |

No database migrations. No edge function changes. No new dependencies.

---

## User Experience Flow

```text
Creator answers "Yes, published" in Workspace banner
          ↓
user_feedback row written (existing behavior)
collab_requests.status → 'published' (new)
          ↓
Requests dashboard: card moves from "Approved" tab → "Published" tab
Card shows: ✨ Published badge + "View Final Workspace" button
          ↓
Guest's "Sent Requests" view: badge shows "✨ Published"
Workspace button remains accessible as "View Published Work"
```

This turns the "Approved" tab into a true active To-Do list, and the "Published" tab into a permanent archive of completed collaborations.
