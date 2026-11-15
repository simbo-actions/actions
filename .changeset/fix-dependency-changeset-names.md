---
'changelog': patch
---

Take over the changesets of merged npm updates by the names the script writes.

- The workflow `checks` looked for `dependency-updates-*.md`, but the script
  writes `update-dependencies-*.md` and `update-development-dependencies-*.md`;
  the job would have failed after the first merged npm update.
- It accepts one or two changesets: one for the actions with changed bundled
  dependencies, one for all other dependencies.
