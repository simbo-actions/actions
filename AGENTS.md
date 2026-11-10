# Rules for assistants

Monorepo for the GitHub Actions of `simbo-actions`. Read [README.md](README.md),
[CONCEPT.md](CONCEPT.md), and [CONTRIBUTING.md](CONTRIBUTING.md) first. Change
this file only when the owner asks for it; keep it to about one screen.

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

## Actions

- One workspace per action in `actions/<name>/`, published to
  `simbo-actions/<name>`. `changelog/` holds the monorepo changelog.
- Repositories outside this monorepo use the actions from `main` until they pin
  the published repositories by SHA. Keep the interface on `main` compatible:
  new inputs are optional; breaking changes only after the owner agrees.
- Every change to an action comes with a changeset (`pnpm exec changeset`); use
  `--empty` for changes without a release.

## Workflows

- `permissions: {}` at workflow level, the needed permissions per job.
- Third-party actions pinned by SHA with the tag as a comment. Own actions via
  `./actions/<name>`.
- Inputs and secrets reach `run` scripts via `env`, never via `${{ }}` inside
  the script.
- Jobs that need the app secrets use
  `environment: { name: release, deployment: false }` and run only on `main` or
  release tags.

## Checks

- Verify with `pnpm preflight` and report checks that were not run.
- Preserve the shared `@simbo` configurations; ask before changing their rules.
