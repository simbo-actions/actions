---
'changelog': patch
---

Require annotated release tags in STANDARDS.md.

- Only commits are required to be verified; tags are not signed, because GitHub
  does not sign tag objects created via the API.
- Release tags are annotated tags with the message `Release <tag>`; older
  release tags in action repositories stay lightweight.
