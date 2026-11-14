# 🔄 Simbo's Actions — Tooling

Monorepo-specific checks and helpers used by the workflows. Not published.

- [`bin/check-actions.ts`](bin/check-actions.ts): checks that every action has
  its own `LICENSE.md`, that its README links the same year, has all required
  sections, and starts with the note about the monorepo
  (`pnpm run check:actions`).
- [`bin/create-dependency-changeset.ts`](bin/create-dependency-changeset.ts):
  after a merged Dependabot update of npm dependencies, writes a patch changeset
  for the affected actions (workflow `checks`, job `dependency-changeset`).

The scripts are TypeScript with erasable syntax only, so Node.js runs them
directly without a build step. Everything that is useful beyond this repository
is an action in `actions/`.
