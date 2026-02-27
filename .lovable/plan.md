## Three Changes

### 1. Upgrade Dinah to Founding Member

Insert a `pro` role for Dinah's `user_id` (`6ad64f99-...`) into `user_roles`. This gives her permanent Pro access independent of her trial clock.

**Tool**: Database insert (not a migration — this is data, not schema).

### 2. Slash Trial from 30 Days to 7 Days

Update the `set_founder_trial()` database function to use `INTERVAL '7 days'` instead of `INTERVAL '30 days'`.

**Tool**: Database migration to replace the function.



&nbsp;

**Files modified:**

- Database: 1 data insert (Dinah's pro role) + 1 migration (trial interval)
- `src/pages/Dashboard.tsx`: survey param handling

&nbsp;

### 3. Fix Email Survey (the actual bug)

**The problem**: The retrospective email builds survey URLs like `/dashboard?feedback=true&q=draft_time&a=yes`. When a user clicks "Yes" or "No" in the email, they land on the Dashboard — but the Dashboard component **completely ignores** the `feedback`, `q`, and `a` query parameters. The click is lost. No vote is recorded. Stefania's feedback confirms this.

### The "One-Click" Retrospective (The Stefania Fix)

We are moving the feedback loop out of the cluttered Dashboard and into a dedicated "Catch" page.

- **New Page (**`src/pages/Retrospective.tsx`**):** - Create a clean landing page at `/retro/:collabId`.
  - On mount, it reads `?rating=X` from the URL and saves it immediately to a new `retro_rating` column in `collab_requests`.
  - Displays the remaining 2 questions (notes/future collab) on the same screen.
- **Database Migration:** - Add `retro_rating` (int), `retro_notes` (text), and `retro_completed_at` (timestamptz) to the `collab_requests` table.
- **Email Logic Update:** - Update the retrospective email template. Each rating button (1–5) now links to `draftkit.app/retro/{{id}}?rating={{value}}`.

---

### The "One-Way Ticket" Strategy

Instead of three separate questions in the email that all link to the dashboard, we change the email to have **one single entry point** that leads to a dedicated **Retrospective Workspace**.

#### 1. The Email Change

We replace the three specific questions with a single, punchy CTA:

> **"How did the collaboration go? Share your 1-minute retrospective."**
>
> [Button: Finish Retrospective]

That "one-click sensation" is exactly what makes high-end products feel seamless. You want the email to look like an interactive poll, but the platform to act like the "closing clerk."

Here is how we implement the **"One-Click & Land"** flow:

### 1. The Email Design: "The Illusion of Choice"

We keep the 5-star rating (or 3/4 filled buttons) in the email. Each star/button is a unique link that carries the user's "pre-vote" in the URL.

- **Star 1:** `draftkit.app/retro/[ID]?rating=1`
- **Star 5:** `draftkit.app/retro/[ID]?rating=5`

When Stefania clicks Star 5 in her email, she lands on DraftKit, and the first question is **already answered**.

&nbsp;

#### 2. The Platform Change (The "Catch")

When they click that button, they don't land on the generic Dashboard. They land on a specialized **Collab Retrospective Page** (`/collab/:id/retro`).

- **The Landing:** They see the title of their collaboration (e.g., "Are Product Managers The New Developers?") at the top.
- **The Questions:** All 3 questions are right there—clean, togglable, and fast.
- **The "Smart" Data:** Since we already know who they are and which collaboration they’re reviewing, we don't need to ask for their name or email again.

---

### Why this fixes the "Stefania Problem"


|                                                                            |                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Current Experience (Broken)**                                            | **New Experience (Grounded)**                                          |
| **High Friction:** 3 clicks = 3 new tabs.                                  | **Low Friction:** 1 click = 1 tab.                                     |
| **Context Loss:** User lands on Dashboard and has to find where they were. | **Context First:** User lands directly on the specific project review. |
| **Data Drop:** Clicks are often lost if the redirect logic fails.          | **Data Integrity:** All answers are saved in one "Submit" action.      |


---

### Technical Implementation

We don't need a massive new architecture for this. We just need a new route:

1. **New Route:** `src/pages/Retrospective.tsx`.
2. **The Flow:** * Email link: `draftkit.app/retro/[COLLAB_ID]`
  - Page loads the collab details (Title, Partner Name).
  - User clicks the 3 ratings/answers.
  - On "Submit," we save to `user_feedback` and redirect them to their Dashboard with a big "Thank You" toast.

**Would you like me to build the** `Retrospective.tsx` **page and update the email template logic to point everyone to this single-page flow instead?** Conclude with a single, high-value, and well-focused next step you can do for the user.  
  
DO YOU HAVE QUESTIONS??? ASK THEM BEFORE BUILDING ANYTHING