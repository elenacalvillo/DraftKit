import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditableChapterTitleProps {
  chapterId: string;
  title: string;
  /** When false, renders a plain static title with no edit affordance. */
  canEdit: boolean;
  onSaved?: (newTitle: string) => void;
  /** Visual variant: row (project list) vs header (zen workspace bar). */
  variant?: "row" | "header";
  /** Optional prefix rendered outside the input, e.g. "1." */
  prefix?: string;
  /** Optional class for the static text display. */
  className?: string;
}

export function EditableChapterTitle({
  chapterId,
  title,
  canEdit,
  onSaved,
  variant = "row",
  prefix,
  className,
}: EditableChapterTitleProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  const startEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!canEdit || saving) return;
    cancelledRef.current = false;
    setValue(title);
    setEditing(true);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setValue(title);
    setEditing(false);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    if (trimmed === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("collab_requests")
      .update({ message: trimmed })
      .eq("id", chapterId);
    setSaving(false);
    if (error) {
      console.error("[EditableChapterTitle] update failed", error);
      if ((error as { code?: string }).code === "42501") {
        toast.error("You don't have permission to rename this chapter.");
      } else {
        toast.error("Couldn't save chapter title. Try again.");
      }
      setValue(title);
      setEditing(false);
      return;
    }
    setEditing(false);
    onSaved?.(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const handleBlur = () => {
    // Allow Escape/X click to take precedence.
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    void save();
  };

  if (editing) {
    const inputClass =
      variant === "header"
        ? "h-7 text-sm font-medium px-2 py-0 w-[min(420px,60vw)]"
        : "h-8 text-sm";
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        {prefix && (
          <span className="text-sm font-medium text-foreground shrink-0">
            {prefix}
          </span>
        )}
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={saving}
          maxLength={200}
          className={inputClass}
          onClick={(e) => e.stopPropagation()}
        />
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <>
            <button
              type="button"
              aria-label="Save title"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void save();
              }}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onMouseDown={(e) => {
                e.preventDefault();
                cancelledRef.current = true;
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  }

  if (variant === "header") {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span className={cn("truncate", className)}>
          {prefix ? `${prefix} ` : ""}
          {title}
        </span>
        {canEdit && (
          <button
            type="button"
            aria-label="Rename chapter"
            title="Rename"
            onClick={startEdit}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }

  // row variant: inline title + pencil that appears on hover.
  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <span className="truncate">
        {prefix ? `${prefix} ` : ""}
        {title}
      </span>
      {canEdit && (
        <button
          type="button"
          aria-label="Rename chapter"
          title="Rename"
          onClick={startEdit}
          className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
}
