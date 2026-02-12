

# Add Delete (Dismiss) Button for Declined Requests

## What changes

Add a dismiss/delete button to declined requests, matching the existing pattern used for cancelled requests.

## Single file change: `RequestCard.tsx`

### Add a "Declined" status indicator block

Right after the cancelled status block (line 511), add a nearly identical block for declined requests:

```text
{request.status === "declined" && onDelete && (
  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Ban className="w-4 h-4" />
      <span className="text-sm">This request was declined.</span>
    </div>
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onDelete(request.id)}
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      title="Dismiss"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
)}
```

This uses the same `hidden_by_creator` soft-delete mechanism already wired up in `Requests.tsx` via `handleDelete`. No database or RLS changes needed -- the existing logic handles it.

