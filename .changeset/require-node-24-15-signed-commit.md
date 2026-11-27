---
'signed-commit': patch
---

Require Node.js 24.15.0 or a later 24.x release.

- `engines.node` in `package.json` is `^24.15.0` instead of `>=24.8`.
- The bundled `@simbo` packages need Node.js 24.15.0 or later; the upper bound
  follows the runtime `node24` the action runs with.
- The limitations in the README name Node.js 24.15 or later, which GitHub-hosted
  runners provide.
