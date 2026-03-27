import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface CommentInputProps {
  initialComment?: string;
  isEditing?: boolean;
  onSave: (comment: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  anchorRect?: { top: number; left: number } | null;
}

export function CommentInput({
  initialComment = "",
  isEditing = false,
  onSave,
  onCancel,
  onDelete,
  anchorRect,
}: CommentInputProps) {
  const [text, setText] = useState(initialComment);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div
      className="fixed z-[110] w-72 rounded-lg border shadow-lg p-3 flex flex-col gap-2"
      style={{
        background: "hsl(45 93% 94%)",
        borderColor: "hsl(45 70% 75%)",
        top: anchorRect ? anchorRect.top : "50%",
        left: anchorRect ? anchorRect.left : "50%",
        transform: anchorRect ? undefined : "translate(-50%, -50%)",
      }}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add your comment…"
        rows={3}
        className="w-full text-sm rounded-md border border-yellow-300/60 bg-white/80 dark:bg-yellow-950/30 px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400/50 text-foreground"
      />
      <div className="flex items-center justify-between gap-2">
        <div>
          {isEditing && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={handleSave}
            disabled={!text.trim()}
          >
            {isEditing ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
