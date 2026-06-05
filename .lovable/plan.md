# Unblock Book Export (Fix Modal Freeze)

The postMessage errors in the screenshot are a symptom, not the cause — they're harmless cross-origin warnings from the Lovable preview wrapper. The real issue: `exportBookProject` runs a tight synchronous loop that builds dozens of `.docx`/`.md`/PDF chapters on the main thread, freezing the UI (and the modal's progress bar) until it's done.

Fix is purely client-side, in three files. No schema, no deps, no backend.

## What changes

### 1. `src/lib/book-export.ts` — yield between chapters

- Add a tiny `yieldToBrowser()` helper that awaits a `requestAnimationFrame` (falls back to `setTimeout(0)`), and call it **before each chapter** in the `zip-docx` and `zip-md` loops, and once before `chaptersToCombinedDocxBlob` / `chaptersToCombinedPdfBlob`.
- Report progress **before** the heavy work for each chapter (so the bar moves immediately), then yield, then build.
- Wrap `zip.generateAsync` with `streamFiles: true` so JSZip itself yields during compression.
- For the combined `.docx` and `.pdf` paths, push progress in stages ("Preparing title page…", "Rendering chapter X of N…", "Finalizing file…") by passing an `onProgress` callback down into `chaptersToCombinedDocxBlob` and `chaptersToCombinedPdfBlob` and yielding between chapter conversions inside those functions.

### 2. `src/lib/html-to-docx.ts` and `src/lib/html-to-pdf.ts` — accept progress + yield

- Extend `chaptersToCombinedDocxBlob(title, chapters, onProgress?)` and `chaptersToCombinedPdfBlob(...)` to loop chapters with an `await yieldToBrowser()` between each, calling `onProgress` per chapter.
- Keep single-chapter `htmlToDocxBlob` synchronous (it's already fast); the yielding lives at the orchestration layer where the loop runs.

### 3. `src/components/projects/ExportBookDialog.tsx` — instant feedback

- On click, immediately set `busy=true` and seed `progress` to `{ current: 0, total: chapters?.length ?? 1, label: "Assembling files…" }` **before** awaiting `exportBookProject`, so the user sees the spinner + label without waiting for the first `onProgress` tick.
- Disable the format buttons and close affordance while `busy` (already done) — just confirm the initial paint happens before any heavy work.
- Add a short "This can take a minute for long books" helper line under the progress bar.

### One small thing to watch out for:

In **Step 3**, when Lovable modifies `ExportBookDialog.tsx`, make sure the text helper line matches your high-signal, clean UI style. Something simple like: *"Compiling chapters. This may take a moment for longer projects."*

## Why this works

- `await new Promise(r => requestAnimationFrame(r))` between chapters returns control to the browser long enough to paint the progress bar, run rAF callbacks, and drain the postMessage queue from the Lovable preview shell. The "tilting / freezing" goes away because the main thread is no longer monopolized.
- `JSZip.generateAsync({ streamFiles: true })` chunks compression internally, which is the documented fix for large-archive UI jank.
- No Web Worker needed — yielding is sufficient for the chapter counts we expect, and a Worker would force us to bundle `docx`/`pdfmake`/`jszip` twice.

## Out of scope

- Moving generation into a Web Worker (overkill for now; can revisit if a user reports >100 chapters).
- Suppressing the `postMessage` console warnings — those come from the Lovable preview iframe and are unrelated to the export logic.
- Any change to chapter content, table converter, or markdown output.

## Files touched

- `src/lib/book-export.ts`
- `src/lib/html-to-docx.ts`
- `src/lib/html-to-pdf.ts`
- `src/components/projects/ExportBookDialog.tsx`