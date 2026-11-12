# 🔄 Simbo's Actions — Tooling

Scripts used by the workflows of this monorepo. Not published.

- [`src/rate-limit.ts`](src/rate-limit.ts): retries GitHub API requests on rate
  limits.
- [`src/configure-action-repository.ts`](src/configure-action-repository.ts):
  applies the standard settings and rulesets to an action repository (publish).
- [`src/publish-release.ts`](src/publish-release.ts): creates a release as
  draft, uploads the assets, and publishes it (publish).
- [`bin/check-licenses.ts`](bin/check-licenses.ts): checks the licenses of all
  production dependencies against the allowed licenses (checks).
- [`bin/check-action-licenses.ts`](bin/check-action-licenses.ts): checks that
  every action has its own `LICENSE.md` and that its README links the same year
  (checks).
- [`bin/create-dependency-changeset.ts`](bin/create-dependency-changeset.ts):
  after a merged Dependabot update of npm dependencies, writes a patch changeset
  for the affected actions (checks, job `dependency-changeset`).

The scripts are TypeScript with erasable syntax only, so Node.js runs them
directly without a build step, also via `actions/github-script`.
