# Fix blank project pages

Confirmed cause. The project page crashes with:

```text
Rendered more hooks than during the previous render.
```

My last change added the per-row "Resend invite" loading state (`resendingEmail`)
below the page's early loading/not-found returns instead of at the top with the
other state hooks. React requires every hook to run on every render, so once the
project data arrives the hook count changes and the whole page unmounts to a
blank screen. The projects list still works; only individual project pages break.
No data was lost and no database change caused this.

## The fix

Move the `resendingEmail` state declaration up next to the other `useState`
declarations in `ProjectDetail`, above the loading and not-found guards, leaving
the handler where it is.

Then verify in a real browser that a project page renders chapters again, and
that the Resend invite button still spins only for the row clicked.

## Technical notes

- `src/pages/ProjectDetail.tsx`: relocate `const [resendingEmail, setResendingEmail] = useState<string | null>(null)`
  from line 274 to the hook block near line 184; no other logic changes.
