---
'changelog': patch
---

Create the version tags as annotated tags with `signed-commit` v2.0.0.

- Release and Publish set `tag-message: Release {tag}`, so every version tag in
  the monorepo and in the action repositories names its release, for example
  `Release signed-commit/v2.0.0`.
- Checks and Publish Organization use `signed-commit` v2.0.0 as well; they
  create no tags.
- ARCHITECTURE.md describes the version tags; older version tags in the action
  repositories stay lightweight, because their releases are immutable.
