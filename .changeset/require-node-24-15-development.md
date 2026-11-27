---
'changelog': patch
---

Require Node.js 24.15.0 or a later 24.x release for development.

- `engines.node` is `^24.15.0` in the root, `changelog`, and `tooling`.
- The shared `@simbo` packages need Node.js 24.15.0 or later; the upper bound
  keeps development on the major version the actions run with.
- `.nvmrc` stays at 24.21.0, which meets it.
