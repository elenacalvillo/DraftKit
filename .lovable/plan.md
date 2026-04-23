

## Plan: Two-step Collaboration Playbook (Vibe → Format)

**Problem:** The current Playbook flattens 8 unrelated checkboxes ("How we work" mixed with "What we make") into one list. Decision fatigue → guests message hosts asking "what do you actually want?"

**Fix:** Split the choice into two clear steps that mirror how creators actually think.

---

### The new mental model

**Step 1 — Vibe (the "How"):** single-select, always shown
- ✍️ **Async Workspace** — Write together inside the engine
- 📺 **Substack Live** — Record a Live conversation on Substack
- ☕ **Video Call** — A Zoom/Meet conversation

**Step 2 — Format (the "What"):** multi-select, **only shown when Vibe = Async**
- 🎙️ **Interview** — Q&A style
- 🔁 **Cross-post** — Collaborative deep-dive on a shared topic
- 📝 **Guest-post** — One person takes the lead on the other's newsletter

If Vibe = Substack Live or Video Call, no Step 2 — the format is implicit.

---

### Data model — backwards compatible

We already store `collab_style` as a JSON string of an array. We add two new fields without breaking existing data:

| New field on `creators` | Type | Purpose |
|---|---|---|
| `collab_vibe` | `text` (`'async' \| 'live' \| 'call'`) | Step 1 selection. Default `'async'`. |
| `collab_formats` | `text` (JSON array) | Step 2 selections (only for async). |

**Migration:** for each existing creator, derive `collab_vibe` + `collab_formats` from current `collab_style`:
- Contains `Virtual Coffee` → vibe `call`
- Contains `Live Event / Webinar` → vibe `live`
- Anything else → vibe `async`, and map old types to new formats:
  - `Async Drafting`, `Co-written Article` → `cross-post`
  - `Interview Style` → `interview`
  - `Guest Post Exchange` → `guest-post`
  - `Newsletter Shoutout`, `Custom` → dropped (folded into Guidelines text)

`collab_style` stays in place as a derived/legacy column for one release so nothing breaks; we'll remove read paths in the same PR but keep writes synced.

---

### UI changes

**`src/pages/Settings.tsx` — Collaboration Playbook section (lines 461–510)**
- Replace the flat 8-checkbox grid with two sequential blocks:
  1. "How do you like to collaborate?" → 3 single-select cards (Async / Substack Live / Video Call). Recommended badge stays on Async.
  2. "What formats are you open to?" → 3 multi-select chips (Interview / Cross-post / Guest-post). Renders only when vibe = `async`.
- Remove the duplicative "How do you prefer to collaborate?" block below (lines 512–585) — it's now merged into Step 1, so Pro gating moves with it (Substack Live + Video Call become free; **vibe = async** stays default for everyone, no Pro gate needed).

**`src/pages/PublicBooking.tsx` (lines 281–287, 869–905)**
- Read the new fields. Header chips become: shows the vibe as a primary line ("Async drafting via DraftKit") and formats as small chips underneath. If vibe = Live/Call, just show the vibe.
- Booking step where guest "selects collab type" only fires for async + multiple formats. Calls/Live skip straight to date pick.

**`src/lib/validations.ts`**
- Add `COLLAB_VIBE_OPTIONS` (`'async' | 'live' | 'call'`) + `COLLAB_FORMAT_OPTIONS` (`'interview' | 'cross-post' | 'guest-post'`) with metadata (label, icon, description, outcome).
- Keep `COLLAB_TYPE_METADATA` for one release (read-only) so emails / RequestCard select work without same-PR refactors.

**`src/components/requests/RequestCard.tsx` (line 39, 420)**
- The collab-type override dropdown becomes the format list when vibe = async, otherwise hidden (no override needed for live/call).

**`supabase/functions/send-collab-email/index.ts` + `generate-collab-draft/index.ts`**
- Read `collab_vibe` to pick email copy. Read `collab_formats[0]` (or the guest's `selected_collab_type`) to pick draft template. Existing case-statement keys still work because we'll keep the legacy strings in the `selected_collab_type` field on requests until next cleanup pass.

---

### Files

| File | Change |
|---|---|
| SQL migration | Add `collab_vibe`, `collab_formats` columns + backfill from `collab_style` |
| `src/lib/validations.ts` | Add vibe/format options + metadata; keep legacy types |
| `src/pages/Settings.tsx` | Replace flat list with Vibe (Step 1) + Format (Step 2, async-only). Merge duplicate "How do you prefer to collaborate?" block into Step 1. |
| `src/pages/PublicBooking.tsx` | Render vibe/formats; skip format-pick when vibe ≠ async |
| `src/components/requests/RequestCard.tsx` | Hide format dropdown when vibe ≠ async |
| `src/hooks/useAuth.tsx` | Add `collab_vibe`, `collab_formats` to Creator type |
| `supabase/functions/send-collab-email/index.ts` | Branch email copy on `collab_vibe` |

### Out of scope
- Removing `collab_style` column (next release, after one stable cycle)
- Folding Newsletter Shoutout / Custom into the new model — Guidelines field already covers these as freeform notes
- Renaming `selected_collab_type` on requests (still works as-is)

