---
'changelog': patch
---

Run the independent steps of the tooling scripts in parallel.

- `create-dependency-changeset` lists the production packages of all actions and
  reads the dependencies of all workspaces at the same time, in the commit and
  in its parent.
- `check-actions` reads the files of all actions and all workflows at the same
  time; the license check does the same per action. The problems keep their
  order.
