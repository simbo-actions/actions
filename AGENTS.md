# Rules for assistants

Monorepo for the GitHub Actions of `simbo-actions`. Read [README.md](README.md),
[STANDARDS.md](STANDARDS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and
[DEVELOPMENT.md](DEVELOPMENT.md) first. Change this file only when the owner
asks for it; keep it to about one screen.

## Collaboration

- Talk to the owner in German. Everything in the repository is American English.
- The owner is the sole maintainer. Discuss before implementing; a discussion is
  not permission to start the work.
- No staging, commits, pushes, tags, releases, or changes to GitHub settings
  without an explicit request.
- Never read, write, or output secrets, not even in part. Refer to them by name.
- This repository is public. No internal details about other repositories,
  accounts, or their state.
- No new tooling, platforms, or dependencies without a request.

## Standards

- [STANDARDS.md](STANDARDS.md) applies to every change, without exceptions:
  Node.js actions in strict TypeScript, composite actions only to compose other
  actions, at least 90 % test coverage, least privilege for tokens, third-party
  actions pinned by SHA, inputs and secrets via `env` in scripts.
- Every change gets a changeset, as described in "Writing Changesets" in
  [DEVELOPMENT.md](DEVELOPMENT.md#writing-changesets): one for an action when
  its published content changes for its users, otherwise one for the private
  `changelog` package; one topic each, a summary paragraph with the details as a
  list, never empty.
- Keep the workflow style: emoji names, header comment, `run-name`,
  `concurrency`, `set -euo pipefail`.
- Maintenance tasks follow the runbooks in [MAINTAINING.md](MAINTAINING.md).
- Verify with `pnpm run preflight` and report checks that were not run.
- Preserve the shared `@simbo` configurations; ask before changing their rules.
