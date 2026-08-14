import { useEffect, useRef, useState } from "react";
import { BookImage, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateBookMetadata } from "@/hooks/useProjects";
import {
  ACCEPTED_COVER_MIME_TYPES,
  getCoverUrl,
  removeCoverObject,
  uploadProjectCover,
} from "@/lib/project-cover";

export interface BookDetailsProject {
  id: string;
  title: string;
  author_name: string | null;
  subtitle: string | null;
  book_description: string | null;
  isbn: string | null;
  language: string;
  cover_image_path: string | null;
  cover_image_mime: string | null;
  cover_image_bytes: number | null;
}

interface BookDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: BookDetailsProject;
}

export function BookDetailsDialog({ open, onOpenChange, project }: BookDetailsDialogProps) {
  const { creator } = useAuth();
  const updateMeta = useUpdateBookMetadata();
  const fileRef = useRef<HTMLInputElement>(null);

  const [author, setAuthor] = useState(project.author_name ?? creator?.name ?? "");
  const [subtitle, setSubtitle] = useState(project.subtitle ?? "");
  const [description, setDescription] = useState(project.book_description ?? "");
  const [isbn, setIsbn] = useState(project.isbn ?? "");
  const [language, setLanguage] = useState(project.language || "en");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAuthor(project.author_name ?? creator?.name ?? "");
    setSubtitle(project.subtitle ?? "");
    setDescription(project.book_description ?? "");
    setIsbn(project.isbn ?? "");
    setLanguage(project.language || "en");
    setCoverUrl(null);
    if (project.cover_image_path) {
      getCoverUrl(project.cover_image_path).then(setCoverUrl);
    }
  }, [open, project, creator?.name]);

  const usedBytes = async (): Promise<number> => {
    if (!creator?.id) return 0;
    const { data } = await supabase
      .from("creators")
      .select("storage_used_bytes")
      .eq("id", creator.id)
      .maybeSingle();
    return data?.storage_used_bytes ?? 0;
  };

  const handlePick = () => fileRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file || !creator?.id) return;
    setUploading(true);
    try {
      const result = await uploadProjectCover({
        projectId: project.id,
        creatorId: creator.id,
        file,
        currentUsedBytes: await usedBytes(),
        previousPath: project.cover_image_path,
        previousBytes: project.cover_image_bytes,
      });
      await updateMeta.mutateAsync({
        id: project.id,
        cover_image_path: result.path,
        cover_image_mime: result.mime,
        cover_image_bytes: result.bytes,
      });
      setCoverUrl(result.url || (await getCoverUrl(result.path)));
      toast.success("Cover saved. It will be embedded in your ePub exports.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveCover = async () => {
    if (!project.cover_image_path || !creator?.id) return;
    setUploading(true);
    try {
      await removeCoverObject(
        project.cover_image_path,
        creator.id,
        project.cover_image_bytes ?? 0,
      );
      await updateMeta.mutateAsync({
        id: project.id,
        cover_image_path: null,
        cover_image_mime: null,
        cover_image_bytes: null,
      });
      setCoverUrl(null);
      toast.success("Cover removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove cover");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateMeta.mutateAsync({
        id: project.id,
        author_name: author,
        subtitle,
        book_description: description,
        isbn,
        language: language || "en",
      });
      toast.success("Book details saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save book details");
    }
  };

  const busy = uploading || updateMeta.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookImage className="w-4 h-4 text-primary" /> Book details
          </DialogTitle>
          <DialogDescription>
            Your cover and publication details are baked straight into the ePub file, so Kindle and
            Apple Books show the thumbnail without Calibre or any other converter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cover image</Label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-36 rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={`${project.title} cover`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookImage className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handlePick} disabled={busy}>
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1.5" />
                    )}
                    {project.cover_image_path ? "Replace cover" : "Upload cover"}
                  </Button>
                  {project.cover_image_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCover}
                      disabled={busy}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPEG or PNG, up to 10 MB. Portrait 1600x2560 works best on Kindle.
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_COVER_MIME_TYPES.join(",")}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="book-author">Author name</Label>
              <Input
                id="book-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name as it should appear"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-language">Language code</Label>
              <Input
                id="book-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en, es, fr…"
                maxLength={12}
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="book-subtitle">Subtitle</Label>
            <Input
              id="book-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="book-isbn">ISBN</Label>
            <Input
              id="book-isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="book-description">Description</Label>
            <Textarea
              id="book-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Back-cover blurb shown by e-readers and stores"
              rows={4}
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {updateMeta.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
