---
'changelog': patch
---

Document that the release tags point to verified commits without a signature of
their own.

- The runbooks for Dependabot updates and for a broken action in the release
  process check for a tag on a verified commit instead of a verified tag.
- The design decisions in `ARCHITECTURE.md` explain why tag objects stay
  unsigned.
