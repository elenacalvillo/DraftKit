import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { CollabDraft } from "./storage";

/**
 * Export workspace HTML content as a Word document (.docx)
 */
export async function exportWorkspaceHtmlToDocx(html: string, filename: string = "Workspace Draft"): Promise<void> {
  try {
    // Parse HTML and extract text content by paragraph
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const elements = doc.body.children;

    const paragraphs: Paragraph[] = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.trim() || "";
      if (!text) continue;

      if (tag === "h1") {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text, bold: true })],
          spacing: { after: 200 },
        }));
      } else if (tag === "h2") {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text, bold: true })],
          spacing: { after: 200 },
        }));
      } else if (tag === "h3") {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text, bold: true })],
          spacing: { after: 200 },
        }));
      } else if (tag === "ul" || tag === "ol") {
        const items = el.querySelectorAll("li");
        items.forEach((li) => {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: `• ${li.textContent?.trim() || ""}` })],
            indent: { left: 400 },
            spacing: { after: 100 },
          }));
        });
      } else {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text })],
          spacing: { after: 200 },
        }));
      }
    }

    if (paragraphs.length === 0) {
      // Fallback: treat the whole thing as one paragraph
      const fallbackText = doc.body.textContent?.trim() || "";
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: fallbackText })] }));
    }

    const wordDoc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(wordDoc);
    const safeName = filename.replace(/[<>:"/\\|?*×]/g, "-").replace(/\s+/g, " ").trim();
    saveAs(blob, `${safeName}.docx`);
  } catch (error) {
    console.error("Error generating Word document from workspace:", error);
    throw error;
  }
}

/**
 * Sanitize a filename by removing or replacing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*×]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format the draft content as plain text for Google Docs export
 */
function formatDraftAsPlainText(draft: CollabDraft, requesterName: string): string {
  const lines: string[] = [];
  
  lines.push(draft.title);
  lines.push("");
  lines.push(`Format: ${draft.suggestedFormat} | Estimated Read Time: ${draft.estimatedReadTime}`);
  lines.push("");
  lines.push("--- Opening Hook ---");
  lines.push(draft.hook);
  lines.push("");
  lines.push("--- Outline ---");
  
  draft.outline.forEach((section, index) => {
    const contributorLabel = section.contributor === "creator" 
      ? "You" 
      : section.contributor === "requester" 
        ? requesterName 
        : "Both";
    lines.push(`${index + 1}. ${section.section} [${contributorLabel}] (~${section.suggestedLength})`);
    lines.push(`   ${section.description}`);
  });
  
  lines.push("");
  lines.push("--- Talking Points ---");
  draft.talkingPoints.forEach((point) => {
    lines.push(`• ${point}`);
  });
  
  lines.push("");
  lines.push("--- Tone Notes ---");
  lines.push(draft.toneNotes);
  
  return lines.join("\n");
}

/**
 * Export draft to Google Docs by copying content to clipboard and opening a new document
 * Returns a promise that resolves when content is copied
 */
export async function exportToGoogleDocs(draft: CollabDraft, requesterName: string): Promise<void> {
  const content = formatDraftAsPlainText(draft, requesterName);
  
  // Copy content to clipboard first
  await navigator.clipboard.writeText(content);
  
  // Open blank Google Docs
  window.open("https://docs.google.com/document/create", "_blank");
}

/**
 * Export draft as a formatted Word document (.docx)
 */
export async function exportToDocx(draft: CollabDraft, requesterName: string): Promise<void> {
  try {
    const contributorLabel = (contributor: "creator" | "requester" | "both") => {
      switch (contributor) {
        case "creator":
          return "You";
        case "requester":
          return requesterName;
        case "both":
          return "Both";
      }
    };

    const doc = new Document({
      sections: [
        {
          children: [
            // Title
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: draft.title, bold: true })],
              spacing: { after: 200 },
            }),
            
            // Metadata
            new Paragraph({
              children: [
                new TextRun({ text: `Format: ${draft.suggestedFormat}`, italics: true }),
                new TextRun({ text: "  |  " }),
                new TextRun({ text: `Estimated Read Time: ${draft.estimatedReadTime}`, italics: true }),
              ],
              spacing: { after: 400 },
            }),
            
            // Opening Hook section
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Opening Hook", bold: true })],
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: draft.hook, italics: true })],
              spacing: { after: 400 },
              indent: { left: 400 },
            }),
            
            // Outline section
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Outline", bold: true })],
              spacing: { before: 400, after: 200 },
            }),
            
            // Outline items
            ...draft.outline.flatMap((section, index) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${index + 1}. `, bold: true }),
                  new TextRun({ text: section.section, bold: true }),
                  new TextRun({ text: ` [${contributorLabel(section.contributor)}]`, italics: true }),
                  new TextRun({ text: ` (~${section.suggestedLength})` }),
                ],
                spacing: { before: 200 },
              }),
              new Paragraph({
                children: [new TextRun({ text: section.description })],
                indent: { left: 400 },
                spacing: { after: 100 },
              }),
            ]),
            
            // Talking Points section
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Talking Points", bold: true })],
              spacing: { before: 400, after: 200 },
            }),
            
            // Talking points items
            ...draft.talkingPoints.map((point) =>
              new Paragraph({
                children: [new TextRun({ text: `• ${point}` })],
                indent: { left: 400 },
                spacing: { after: 100 },
              })
            ),
            
            // Tone Notes section
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Tone Notes", bold: true })],
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: draft.toneNotes })],
              indent: { left: 400 },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const filename = sanitizeFilename(draft.title) + ".docx";
    saveAs(blob, filename);
  } catch (error) {
    console.error("Error generating Word document:", error);
    throw error;
  }
}
