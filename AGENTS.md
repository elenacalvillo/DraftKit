# AGENTS.md

- Book project permissions resolve through `project_role()` / `can_manage_project()` in the database and `projectCapabilities()` in `src/lib/access.ts`; never check project roles ad hoc. Why: scattered checks let the UI offer actions the backend rejects.
- Opening any workspace (collab or chapter) is decided only by `has_workspace_access()`, which includes project-wide roles on chapters. Why: a second access path caused "Workspace not found" for invited reviewers.
- Book chapters are created only via the `create_project_chapter` RPC. Why: it assigns owner, order and solo status server-side so admins can add chapters safely.
