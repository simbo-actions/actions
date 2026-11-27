---
'apply-repository-settings': patch
'floating-version-tags': patch
'github-app-bot-user': patch
'gitleaks-scan': patch
'staged-release': patch
---

Require Node.js 24.15.0 or later, like the bundled `@simbo` packages.

- `engines.node` in `package.json` is `>=24.15.0`.
- GitHub-hosted runners provide it; the action still runs with `node24`.
