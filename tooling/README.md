# 🔄 Simbo's Actions — Tooling

Monorepo-specific checks and helpers used by the workflows. Not published.

- [`bin/check-action-licenses.ts`](bin/check-action-licenses.ts): checks that
  every action has its own `LICENSE.md` and that its README links the same year
  (`pnpm run check:action-licenses`).
- [`bin/create-dependency-changeset.ts`](bin/create-dependency-changeset.ts):
  after a merged Dependabot update of npm dependencies, writes a patch changeset
  for the affected actions (workflow `checks`, job `dependency-changeset`).

The scripts are TypeScript with erasable syntax only, so Node.js runs them
directly without a build step. Everything that is useful beyond this repository
is an action in `actions/`.
