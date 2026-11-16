---
'changelog': patch
---

Require no approval on `main` while the project has one maintainer.

- The ruleset "Main Branch" still requires a pull request and the checks; only
  maintainers can merge, so every pull request from someone else is read before
  the merge.
- With a second person with write access, it requires one approval of the last
  push again.
- The workflow `automerge` keeps approving low-risk updates, so that automatic
  merges keep working then.
