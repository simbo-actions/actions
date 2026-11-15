---
'changelog': patch
---

Turn off Actions in the action repositories and in `simbo-actions/.github`.

- The repositories have no workflows.
- The policy of the organization allows only selected actions, and GitHub
  rejected the previous repository setting `allowed_actions: all` with a
  conflict.
