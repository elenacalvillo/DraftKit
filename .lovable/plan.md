## Plan: Book Onboarding & Privacy Trust Signals

Your husband identified two gaps: new users don't understand how book projects work, and users worry their content feeds LLMs. This plan adds lightweight, contextual explanations at the exact points of friction.

---

### 1. Book Onboarding (Fix Expert Bias)

New users see "Book Projects" but have no mental model for how chapters become a manuscript. We add two small, dismissible teaching moments:

#### A. Projects list — empty-state info card

When a user has zero active projects, replace the plain "Create your first book project" text with a brief, value-oriented explanation.

- **What**: A compact info card above the empty-state Card.
- **Copy**: "DraftKit turns your chapters into a single publication-ready manuscript. Write in pieces, export as one."
- **Dismissible**: Yes, via localStorage. Once dismissed, never shown again.
- **Visual**: `BookOpen` icon + muted text, no extra colors.

#### B. Export dialog — top explainer

Inside `ExportBookDialog`, replace the current generic description with one sentence that connects the formats to the chapter concept.

- **Current**: "Download your entire book project in the format you need. Chapters use your saved order."
- **New**: "Your chapters are compiled in order into a single publication-ready file. Pick your format below."

---

### 2. Privacy / LLM Trust Shield

Users fear their IP is training data. We add explicit, point-of-friction reassurance in three places.

#### A. Export dialog — local-processing trust badge

At the bottom of `ExportBookDialog`, below the format list and above the progress bar, add a static trust row.

- **Icon**: `Lock` (or `ShieldCheck`)
- **Copy**: "Your manuscript is compiled locally in your browser. It never leaves your device and is never used to train any language model."
- **Visual**: Small muted text with a subtle success-colored icon. Non-interactive, always visible.

#### B. Workspace — Smart Draft contextual note

In `Workspace.tsx`, near the "Generate SMART Draft" button, add a one-line subtitle that frames the feature as optional and isolated.

- **Copy**: "Smart Draft is 100% optional. DraftKit never stores your writing or uses it for AI training."
- **Visual**: Same muted style as existing helper text.

#### C. Settings — Privacy reassurance panel

Add a new card near the bottom of `Settings.tsx` titled "Your data & privacy".

- **Copy block**:
  - "Everything you write stays yours."
  - "Exports happen in your browser — your manuscript is never uploaded to our servers."
  - "The SMART Draft feature is the only optional AI-assisted tool. It runs when you explicitly request it and does not use your content for model training."
- **Visual**: Standard `glass-card p-6` section, matching existing Settings cards.

---

### Files to change


| File                                           | Change                                                 |
| ---------------------------------------------- | ------------------------------------------------------ |
| `src/pages/Projects.tsx`                       | Add dismissible empty-state info card (A)              |
| `src/components/projects/ExportBookDialog.tsx` | Update DialogDescription (B), add trust badge row (2A) |
| `src/pages/Workspace.tsx`                      | Add subtitle under SMART Draft button (2B)             |
| `src/pages/Settings.tsx`                       | Add "Your data & privacy" card (2C)                    |


---

### No-go items (out of scope)

- No new dependencies.
- No backend changes.
- No changes to export logic, Smart Draft generation, or workspace saving.
- No modal tours, tooltips, or animations beyond existing Framer patterns.