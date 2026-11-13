---
'floating-version-tags': major
---

Initial release: move floating version tags like `v1` forward to a release, only
to the highest stable version of their line, never to prereleases. Supports
prefixed tags like `my-package/v1.2.3`, versions without `v`, annotated tags
with a message, the tag of the workflow as default, and a job summary.
