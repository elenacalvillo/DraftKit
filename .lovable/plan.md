# Plan: Replace Content Demo, Revert Landing Page

Two changes needed:

## 1. Revert `src/components/landing/HowItWorksSection.tsx`

The current 6-pillar version needs to be reverted to the **pre-rewrite state** — the original 4-step "How It Works" flow that was on the landing page before. Since I don't have the exact previous version in code, the cleanest approach is to **use the revert button** on the chat message where the 6-pillar rewrite was applied to `HowItWorksSection.tsx`.

However, that would also undo other changes made in the same session. So instead:

**Restore the original 4-step content** in `HowItWorksSection.tsx` — the version with steps: Create Your Profile, Set Your Availability, Share Your Link, Start the Conversation — but keep the Growth Loop copy updates (referral note on Step 01, `h-full` on cards, "collaboration credit" terminology) from the earlier approved plan.

This means `HowItWorksSection.tsx` goes back to the 4-step vertical list layout with the Growth Loop polish applied.

## 2. **Update** `src/pages/Demo.tsx` **with the 6-Pillar Grid**

- **Structure:** Replace the current content with the 6-pillar 'Roadmap to Growth' 
- **Headline:** 'How we break the loneliness wall'
- **Subheadline:** 'We automate the busywork so you can focus on the relationship.'

**Content for the steps:**

1. **Smart Discovery (Search Icon)**
  - *Body:* Find the right voices even when standard search fails. We look at the source to find collaborators ready to grow with you.
    &nbsp;
2. **The Front Door (Send Icon)**
  - *Body:* Replace messy DMs with a professional request page. Your invite earns both of you a **collaboration credit** toward your next growth milestone.
    &nbsp;
3. **The Smart Draft (Zap Icon)**
  - *Body:* Start your collaboration with an AI-powered foundation. We automate the ideation phase so you can focus on high-value writing.
    &nbsp;
4. **The Shared Room (Users Icon)**
  - *Body:* A dedicated workspace for your team. Manage edits, feedback, and final approvals in one centralized location.
    &nbsp;
5. **The Growth Loop (Gift Icon)**
  - *Body:* DraftKit grows when you grow. Earn extra credits for every writer you bring into the community to scale your network.
    &nbsp;
6. **The Milestone (Trophy Icon)**
  - *Body:* Finalize and ship your post instantly. Preserving your layout kills the manual friction that causes most writers to quit.
    &nbsp;

&nbsp;


| File                                           | Change                                                     |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `src/components/landing/HowItWorksSection.tsx` | Revert to original 4-step layout (with Growth Loop polish) |
| `src/pages/Demo.tsx`                           | Replace 4-step list content with a 6-step list             |
