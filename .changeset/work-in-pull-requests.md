---
'changelog': patch
---

Make every change on a branch and merge it as a pull request.

- Branches are named by the type of the change: `feat/`, `fix/`, `docs/`, `ci/`,
  or `chore/`; nobody pushes to `main` directly.
- The ruleset "Main Branch" requires one approval of the last push and dismisses
  stale approvals; organization admins bypass it only when merging a pull
  request.
