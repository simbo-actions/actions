---
'changelog': patch
---

Update `@simbo/eslint-config` to ^4.0.0 in all actions and `tooling`.

- Its Node.js preset reports synchronous APIs with `n/no-sync`; the Git helpers
  of the tests in `gitleaks-scan` and `signed-commit` and the script
  `create-dependency-changeset` use `promisify(execFile)` instead of
  `execFileSync`.
- `create-dependency-changeset` lists the production packages per action, the
  lockfiles of both commits in parallel.
- Its Unicorn rules since 3.3.0 replace repeated comparisons in the `dry-run`
  validation of `apply-repository-settings` with `includes`, without a change in
  behavior.
