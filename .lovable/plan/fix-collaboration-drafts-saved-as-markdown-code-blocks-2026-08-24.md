# Fix collaboration drafts saved as markdown code blocks

## Confirmed cause

The affected collaboration (`8439806b-f82d-46ed-aec3-0cc5fa0e70c6`) is approved, is not a project chapter, and was saved recently with its entire `shared_content` wrapped as:

```html
<pre><code class="language-markdown">…</code></pre>
```

That wrapper makes both view mode and Tiptap edit mode correctly treat the whole draft as code, so headings and bold markers remain literal. The requested July 9 date only controls the publication follow-up banner and does not affect formatting. Guest status also does not select a different editor or renderer.

The previous paste fix missed this exact clipboard shape because `<code>` is currently classified as genuine rich HTML. The database check found one workspace with this specific legacy wrapper: the collaboration shown in the screenshot.

## Implementation

1. **Recognize markdown code wrappers correctly**
   - Update the clipboard classifier to recognize a whole-document `<pre><code class="language-markdown">…</code></pre>` payload as markdown text.
   - Preserve ordinary code snippets and genuinely rich Google Docs, Word, Notion, and Substack HTML as-is.

2. **Normalize already-saved affected content**
   - Add a narrowly scoped content normalizer that unwraps only whole-document `language-markdown` code blocks, decodes their text safely, converts the markdown to sanitized workspace HTML, and leaves normal HTML untouched.
   - Use the normalized content consistently when entering edit mode and when rendering view mode, so the existing collaboration is fixed immediately without requiring the author to repaste it.
   - Ensure the next confirmed save persists the repaired HTML through the existing secure `save_workspace_content` path.

3. **Keep related actions consistent**
   - Feed normalized content to Copy, Push to Substack, and Download so this affected draft cannot export as a code block before it is resaved.
   - Apply the same safe normalization to the public shared-draft renderer if this workspace is shared externally.

4. **Add regression coverage**
   - Test the exact `<pre><code class="language-markdown">` clipboard shape from the affected record.
   - Test legacy normalization, HTML entity decoding, normal code blocks, and rich-document HTML preservation.
   - Run the focused markdown and clipboard tests and confirm the app build remains clean.

## Safety and scope

- No role, access, RLS, date, publication status, or collaboration permissions will change.
- No broad database rewrite. Only this precise legacy content shape is normalized.
- Existing sanitization, image restrictions, the 1 GB storage cap, and in-app document retention remain intact.
