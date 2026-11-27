---
'signed-commit': patch
---

Require Node.js 24.15.0 or later, like the bundled `@simbo` packages.

- `engines.node` in `package.json` is `>=24.15.0` instead of `>=24.8`.
- The limitations in the README name Node.js 24.15 or later.
- GitHub-hosted runners provide it; the action still runs with `node24`.
