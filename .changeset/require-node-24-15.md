---
'apply-repository-settings': patch
'floating-version-tags': patch
'github-app-bot-user': patch
'gitleaks-scan': patch
'staged-release': patch
---

Require Node.js 24.15.0 or a later 24.x release.

- `engines.node` in `package.json` is `^24.15.0`.
- The bundled `@simbo` packages need Node.js 24.15.0 or later; the upper bound
  follows the runtime `node24` the action runs with.
- GitHub-hosted runners provide it.
