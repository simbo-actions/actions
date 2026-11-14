# changelog

## 0.2.0

### Minor Changes

- 89016b7: Run the published actions, pinned by SHA, in the release.

  - Release, publish, publish-organization, and the dependency changeset use the
    released `signed-commit`, `apply-repository-settings`, `staged-release`, and
    `floating-version-tags` instead of building them in the same run.
  - `check:actions` fails if a job with the environment `release` runs a local
    action.
  - A runbook in MAINTAINING.md describes how to pin back a broken action.

## 0.1.0

### Minor Changes

- fc755ad: Add the standard, architecture, development, and maintenance
  documentation.

  - STANDARDS.md defines the requirements every action and change meets.
  - ARCHITECTURE.md describes how actions are released and published, the GitHub
    Apps, tokens, and trust boundaries.
  - DEVELOPMENT.md and MAINTAINING.md describe how to change the actions and the
    recurring tasks, including how to write changesets.
  - Security policy, support, contributing guide, code of conduct, and issue and
    pull request templates.

- eeea40b: Add the content of the organization repository
  `simbo-actions/.github`.

  - The organization profile with the generated list of actions.
  - Default community files that point to this monorepo.

- 00f0f8e: Add the monorepo tooling.

  - `check:actions` checks license files, README sections, the note about the
    monorepo, identical Octokit clients, matching license lists, and that jobs
    with an environment run no npm code.
  - `create-dependency-changeset` adds the changesets for merged Dependabot
    updates of npm dependencies.
  - `actions-list` generates the list of actions in the organization profile.

- 8a0ee11: Add the workflows that check, test, release, and publish the actions.

  - `checks` builds, tests, lints, and scans every change for vulnerabilities,
    licenses, and secrets, and requires a changeset on pull requests.
  - `smoke-tests` runs the built actions against the GitHub API and writes in
    the repository `simbo-actions/sandbox` as the app `simbo-actions-sandbox`.
  - `release` integrates the changesets with a signed commit and tags every
    released action; `publish` and `publish-organization` publish them with
    build provenance to their own repositories, whose settings are kept as code.
  - Jobs with credentials run no npm code, and builds that are released use no
    cache.
  - Dependabot keeps actions and npm dependencies up to date.

- be34e76: Set up the monorepo for actions that are published to their own
  repositories.

  - pnpm workspaces with Turbo, strict TypeScript, ESLint, Prettier, CSpell, and
    commitlint from the shared `@simbo` configurations.
  - Changesets version every action independently.
  - A Git hook scans staged changes for secrets with Gitleaks.
