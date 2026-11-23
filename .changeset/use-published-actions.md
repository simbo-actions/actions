---
'changelog': patch
---

Use the published actions in the workflows instead of building them in the same
run.

- Release no longer builds `signed-commit`; its release job has used the
  published action since the bootstrap.
- Checks and Security scan for secrets with the published `gitleaks-scan`,
  pinned by SHA, so that a pull request cannot change the scanner that checks
  it. In Checks, the scan runs before any npm code; Security needs no pnpm,
  Node.js, or build any more.
- Only the smoke tests still use the actions built in the same run.
