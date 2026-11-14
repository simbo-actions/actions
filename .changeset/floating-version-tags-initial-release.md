---
'floating-version-tags': major
---

Move floating version tags like `v1` forward to a release.

- Only to the highest stable version of their line, never to a prerelease.
- Lightweight or annotated tags, with a message that names the release.
- Prefixed tags like `my-package/v1.2.3` and versions without `v`.
- The tag of the workflow as default, a dry run, and a job summary.
