import { useEditor, EditorContent } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { StickyComment } from "@/lib/tiptap-sticky-comment";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  ChevronDown,
  Table2,
  Highlighter,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CommentInput } from "./CommentInput";
import { HighlightTooltip } from "./HighlightTooltip";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  isAcceptedImageMime,
} from "@/lib/access";
import {
  isWorkspaceImageFile,
  uploadWorkspaceImage,
  WorkspaceImageError,
} from "@/lib/workspace-images";

interface WorkspaceEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable: boolean;
  currentUserName?: string;
  /**
   * The collab_requests.id this workspace belongs to. Required to
   * upload inline images — every image is scoped to a request under
   * `workspace-images/{requestId}/{filename}` so RLS can authorise
   * the writer. When absent (e.g. preview surfaces that pass static
   * HTML) the image toolbar button is hidden and paste/drop image
   * handling is disabled.
   */
  requestId?: string;
}

// Accepted file types — exposed as a constant so it appears in BOTH
// the `<input accept>` attribute AND the paste/drop guard. Keeping
// these in sync is the difference between "Safari silently no-ops"
// and "Safari shows the correct file picker filter".
const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_MIME_TYPES.join(",");

const NON_IMAGE_DROP_ERROR =
  "Only JPEG, PNG, GIF, and WebP image files can be inserted into the draft.";

/**
 * Walk a DataTransfer / ClipboardData looking for an image file. We
 * check `items` first (preferred for clipboard paste, which surfaces
 * `image/png` even when `files` is empty) and fall back to `files`
 * for drag-and-drop from the desktop.
 */
function findImageInDataTransfer(
  dt: DataTransfer | null | undefined,
): File | null {
  if (!dt) return null;
  if (dt.items && dt.items.length > 0) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind === "file" && isAcceptedImageMime(item.type)) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  if (dt.files && dt.files.length > 0) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (isWorkspaceImageFile(f)) return f;
    }
  }
  return null;
}

/**
 * True when a DataTransfer carries ANY file (image or not). Used to
 * distinguish "user dropped a PDF" (show error) from "user pasted
 * plain text" (let TipTap handle it normally).
 */
function dataTransferHasAnyFile(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  if (dt.files && dt.files.length > 0) return true;
  if (dt.items) {
    for (let i = 0; i < dt.items.length; i++) {
      if (dt.items[i].kind === "file") return true;
    }
  }
  return false;
}

export function WorkspaceEditor({ content, onChange, editable, currentUserName, requestId }: WorkspaceEditorProps) {
  // Track in-progress uploads so we can (a) show a loading indicator,
  // (b) block the editor from being edited mid-upload to prevent the
  // user from typing into the spot the URL is about to land in.
  const [uploadCount, setUploadCount] = useState(0);
  const isUploading = uploadCount > 0;

  /**
   * Upload an image File and insert it into the editor at the given
   * position (or current cursor when `pos` is omitted).
   *
   * This is the SINGLE path used by toolbar / drop / paste. If you
   * find yourself adding a second insertImage code path, route it
   * through this function instead — it's the only place where we:
   *   1. Disable editing during upload
   *   2. Compress + upload via workspace-images.ts
   *   3. Insert ONLY the resulting public URL (never base64)
   *   4. Show error toasts without leaving a broken placeholder
   */
  const insertImageFile = useCallback(
    async (file: File, pos?: number) => {
      if (!requestId) {
        toast.error(
          "This workspace can't accept image uploads yet. Try again in a moment.",
        );
        return;
      }
      if (!isWorkspaceImageFile(file)) {
        toast.error(NON_IMAGE_DROP_ERROR);
        return;
      }

      // editorRef is set below after useEditor — capture inside callback.
      const ed = editorRef.current;
      if (!ed) return;

      setUploadCount((c) => c + 1);
      // While the upload is in flight, freeze the editor so concurrent
      // keystrokes don't shift the target position out from under us
      // before we get the URL back. The ticket's "safe pattern" calls
      // this out explicitly.
      const wasEditable = ed.isEditable;
      ed.setEditable(false);

      try {
        const result = await uploadWorkspaceImage({ requestId, file });
        // setImage is provided by @tiptap/extension-image. We pass the
        // resolved storage URL — never the original File, which would
        // trigger the FileReader → base64 path.
        const chain = ed.chain().focus();
        if (typeof pos === "number") {
          chain.setTextSelection(pos);
        }
        chain.setImage({ src: result.publicUrl, alt: file.name }).run();
      } catch (err) {
        const msg =
          err instanceof WorkspaceImageError
            ? err.message
            : "Couldn't upload that image. Please try again.";
        toast.error(msg);
        // Explicitly DO NOT insert any node — the ticket forbids
        // leaving a broken placeholder in the draft on upload failure.
      } finally {
        ed.setEditable(wasEditable);
        setUploadCount((c) => Math.max(0, c - 1));
      }
    },
    [requestId],
  );

  // Stable refs so the ProseMirror plugin (created once on mount) can
  // call the latest version of insertImageFile without rebuilding the
  // editor on every render.
  const insertImageFileRef = useRef(insertImageFile);
  useEffect(() => {
    insertImageFileRef.current = insertImageFile;
  }, [insertImageFile]);

  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  /**
   * Custom ProseMirror plugin that intercepts paste AND drop events
   * BEFORE TipTap's default Image extension can read the file as a
   * base64 data URI. This is the critical anti-base64 guard called
   * out in the ticket.
   *
   * Returning `true` from the handler tells ProseMirror "I handled
   * this — do not run default behaviour". We do that for any event
   * that carries image data so the default FileReader → base64
   * pipeline never runs.
   */
  const imageUploadPlugin = useMemo(() => {
    return new Plugin({
      props: {
        handlePaste(view, event) {
          const file = findImageInDataTransfer(event.clipboardData);
          if (file) {
            event.preventDefault();
            // Insert at the current selection head.
            insertImageFileRef.current(file, view.state.selection.from);
            return true;
          }
          return false;
        },
        handleDrop(view, event) {
          const dt = event.dataTransfer;
          const file = findImageInDataTransfer(dt);
          if (file) {
            event.preventDefault();
            // Translate the screen-relative drop coordinates into a
            // ProseMirror document position so the image lands where
            // the user actually dropped it (not at the end of the
            // doc, which would happen by default).
            const coordsPos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            insertImageFileRef.current(file, coordsPos?.pos);
            return true;
          }
          // User dropped a non-image file (PDF, .docx, etc) — surface
          // an error instead of letting TipTap insert garbage.
          if (dataTransferHasAnyFile(dt)) {
            event.preventDefault();
            toast.error(NON_IMAGE_DROP_ERROR);
            return true;
          }
          return false;
        },
      },
    });
  }, []);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        validate: (href) => /^https?:\/\//.test(href),
      }),
      // The Image extension renders <img> nodes that we insert via
      // `setImage`. We DO NOT enable `allowBase64` (it defaults to
      // false in v2+, but being explicit guards against an upstream
      // default flip) and we override the default paste/drop handlers
      // with our own plugin above so the built-in FileReader →
      // base64 path is never reached.
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "workspace-inline-image",
        },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      StickyComment,
      // Wrap our paste/drop plugin in a tiny TipTap extension wrapper
      // so it joins the plugin chain at editor creation time.
      {
        name: "workspaceImageUpload",
        addProseMirrorPlugins() {
          return [imageUploadPlugin];
        },
      } as never,
    ],
    [imageUploadPlugin],
  );

  const editor = useEditor({
    extensions,
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "workspace-prose min-h-[300px] px-5 py-4 focus:outline-none font-sans text-[15px] leading-[1.6] break-words",
        style: "overflow-wrap: break-word; word-break: break-word",
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable && !isUploading) {
      editor.setEditable(editable);
    }
  }, [editor, editable, isUploading]);

  const handleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL (must start with https://)", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      window.alert("Only https:// links are allowed.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  // Hidden <input type="file"> driven by the toolbar Image button. We
  // deliberately do NOT use TipTap's built-in image file input — that
  // would route through the same FileReader → base64 path the paste/
  // drop handlers above are designed to prevent.
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageButton = useCallback(() => {
    if (!fileInputRef.current) return;
    // Reset value first so picking the same file twice still fires
    // the change event (Chrome quirk).
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!isWorkspaceImageFile(file)) {
        toast.error(NON_IMAGE_DROP_ERROR);
        return;
      }
      await insertImageFile(file);
    },
    [insertImageFile],
  );

  // Comment input state
  const [commentState, setCommentState] = useState<{
    show: boolean;
    existingComment?: string;
    anchorRect?: { top: number; left: number } | null;
  }>({ show: false });

  const handleHighlighter = useCallback(() => {
    if (!editor) return;

    // Check if cursor is inside an existing highlight
    if (editor.isActive("stickyComment")) {
      const attrs = editor.getAttributes("stickyComment");
      const { view } = editor;
      const { from } = view.state.selection;
      const coords = view.coordsAtPos(from);
      setCommentState({
        show: true,
        existingComment: attrs.comment || "",
        anchorRect: { top: coords.top - 80, left: coords.left },
      });
      return;
    }

    // Must have a selection
    const { from, to } = editor.state.selection;
    if (from === to) return;

    const coords = editor.view.coordsAtPos(from);
    setCommentState({
      show: true,
      anchorRect: { top: coords.top - 80, left: coords.left },
    });
  }, [editor]);

  const handleCommentSave = useCallback(
    (comment: string) => {
      if (!editor) return;
      const author = currentUserName || "Unknown";

      if (commentState.existingComment !== undefined) {
        // Update existing
        editor.chain().focus().extendMarkRange("stickyComment").updateStickyComment({ comment }).run();
      } else {
        // New highlight
        editor.chain().focus().setStickyComment({ comment, author }).run();
      }
      setCommentState({ show: false });
    },
    [editor, currentUserName, commentState.existingComment]
  );

  const handleCommentDelete = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("stickyComment").unsetStickyComment().run();
    setCommentState({ show: false });
  }, [editor]);

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

  if (!editor) return null;

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "H1"
    : editor.isActive("heading", { level: 2 })
    ? "H2"
    : editor.isActive("heading", { level: 3 })
    ? "H3"
    : "Normal";

  const canInsertImage = !!requestId;

  return (
    <div className="flex flex-col min-w-0" ref={containerRef}>
      {/* Editor content */}
      <div className="overflow-hidden min-w-0 relative">
        <EditorContent editor={editor} />
        {/* Loading indicator overlay — appears at the insertion point
            while an image upload is in progress. We position at the
            top-right of the editor rather than at the exact cursor so
            the indicator is always visible even on long drafts. */}
        {isUploading && (
          <div
            role="status"
            aria-live="polite"
            data-testid="workspace-image-uploading"
            className="absolute top-3 right-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 border border-border/60 shadow-sm text-xs text-muted-foreground"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Uploading image…
          </div>
        )}
      </div>

      {/* Hidden file input that the toolbar Image button drives. */}
      {canInsertImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleFileInputChange}
          data-testid="workspace-image-file-input"
        />
      )}

      {/* Highlight tooltip for view mode */}
      <HighlightTooltip containerRef={containerRef as React.RefObject<HTMLDivElement>} />

      {/* Comment input popover */}
      {commentState.show &&
        createPortal(
          <CommentInput
            initialComment={commentState.existingComment || ""}
            isEditing={commentState.existingComment !== undefined}
            onSave={handleCommentSave}
            onCancel={() => setCommentState({ show: false })}
            onDelete={commentState.existingComment !== undefined ? handleCommentDelete : undefined}
            anchorRect={commentState.anchorRect}
          />,
          document.body
        )}

      {/* Floating Pill Toolbar -- portaled to body */}
      {editable && createPortal(
        <div
          className="fixed bottom-8 z-[100] flex items-center gap-0.5 px-3 py-2 bg-background/80 backdrop-blur-md rounded-full shadow-xl border border-border/50"
          style={bounds ? {
            left: bounds.left + bounds.width / 2,
            transform: 'translateX(-50%)',
          } : {
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {/* Heading dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs font-medium gap-1 rounded-full">
                {currentHeading}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              <DropdownMenuItem
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={cn(!editor.isActive("heading") && "bg-accent")}
              >
                Normal text
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={cn(editor.isActive("heading", { level: 1 }) && "bg-accent")}
              >
                <span className="text-lg font-bold">Heading 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(editor.isActive("heading", { level: 2 }) && "bg-accent")}
              >
                <span className="text-base font-bold">Heading 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={cn(editor.isActive("heading", { level: 3 }) && "bg-accent")}
              >
                <span className="text-sm font-bold">Heading 3</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-border/40 mx-1" />

          {/* Text styles */}
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
            <Code className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border/40 mx-1" />

          {/* Code Block */}
          <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
            <SquareCode className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border/40 mx-1" />

          {/* Link */}
          <ToolbarButton active={editor.isActive("link")} onClick={handleLink} title="Link">
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>

          {/* Highlighter */}
          <ToolbarButton active={editor.isActive("stickyComment")} onClick={handleHighlighter} title="Add comment highlight">
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>

          {/* Image upload — only shown when a requestId is available
              so we can scope the storage path correctly. */}
          {canInsertImage && (
            <ToolbarButton
              active={false}
              onClick={handleImageButton}
              title={isUploading ? "Uploading image…" : "Insert image"}
              disabled={isUploading}
              data-testid="workspace-image-toolbar-button"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
            </ToolbarButton>
          )}

          <div className="w-px h-5 bg-border/40 mx-1" />

          {/* Lists */}
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border/40 mx-1" />

          {/* Divider */}
          <ToolbarButton active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider (---)">
            <Minus className="w-4 h-4" />
          </ToolbarButton>

          {/* Table dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Table"
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-md transition-all hover:scale-105",
                  editor.isActive("table")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Table2 className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[150px]">
              <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                Insert Table (3×3)
              </DropdownMenuItem>
              {editor.isActive("table") && (
                <>
                  <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                    Add Row
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                    Add Column
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                    Delete Row
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                    Delete Column
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="text-destructive"
                  >
                    Delete Table
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>,
        document.body
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
  disabled,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "title" | "children" | "disabled">) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md transition-all hover:scale-105",
        disabled && "opacity-50 cursor-not-allowed hover:scale-100",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
