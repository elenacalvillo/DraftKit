import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface WorkspaceEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable: boolean;
}

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    blockquote: false,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    validate: (href) => /^https?:\/\//.test(href),
  }),
];

export function WorkspaceEditor({ content, onChange, editable }: WorkspaceEditorProps) {
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
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

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

  return (
    <div className="flex flex-col min-w-0" ref={containerRef}>
      {/* Editor content */}
      <div className="overflow-hidden min-w-0">
        <EditorContent editor={editor} />
      </div>

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
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md transition-all hover:scale-105",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}
