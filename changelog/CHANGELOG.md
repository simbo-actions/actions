# changelog

## 0.2.10

### Patch Changes

- 4f07bdb: Approve low-risk Dependabot updates before merging them
  automatically.

  - The workflow `automerge` approves minor and patch updates of trusted
    publishers, since the ruleset "Main Branch" requires an approval.
  - All other Dependabot pull requests still need the approval of a maintainer.

- 4f07bdb: Make every change on a branch and merge it as a pull request.

  - Branches are named by the type of the change: `feat/`, `fix/`, `docs/`,
    `ci/`, or `chore/`; nobody pushes to `main` directly.
  - The ruleset "Main Branch" requires one approval of the last push and
    dismisses stale approvals; organization admins bypass it only when merging a
    pull request.

## 0.2.9

### Patch Changes

- bf99636: Rate the monorepo with OpenSSF Scorecard.

  - The workflow `scorecard` runs weekly, on every push to `main`, and when a
    ruleset changes.
  - It uploads the results to code scanning and publishes the score on
    scorecard.dev.
  - The Actions policy of the organization allows `ossf/scorecard-action`.

## 0.2.8

### Patch Changes

- 81ecb65: Update `@types/node` to ^24.19.2.

## 0.2.7

### Patch Changes

- 0046d06: Take over the changesets of merged npm updates by the names the
  script writes.

  - The workflow `checks` looked for `dependency-updates-*.md`, but the script
    writes `update-dependencies-*.md` and
    `update-development-dependencies-*.md`; the job would have failed after the
    first merged npm update.
  - It accepts one or two changesets: one for the actions with changed bundled
    dependencies, one for all other dependencies.

## 0.2.6

### Patch Changes

- 6f53dba: Keep every changelog about its own package.

  - "Writing Changesets" in DEVELOPMENT.md allows a changeset for several
    packages only if its text is true for each of them on its own, without
    naming the others.
  - The entries of version 1.0.3 of `floating-version-tags`,
    `github-app-bot-user`, and `staged-release` describe only their own change;
    the corrected changelogs ship with their next release.

- d50f842: Update all own actions in one Dependabot pull request.

  - The group `simbo-actions` no longer splits by dependency; a release that
    updates several actions brings one pull request instead of one per action.
  - The own actions are pinned only in the workflows, in one directory, so the
    group needs no split by directory.

## 0.2.5

### Patch Changes

- d24c36e: Check the descriptions of the actions in `check:actions`.

  - The description in `action.yml` is a single line of at most 124 characters,
    the limit of the GitHub Marketplace.
  - `package.json` has the same description, and the README starts with it,
    apart from links and code spans.

- f717a9e: Describe the behavior of the Marketplace form in the runbook
  "Marketplace Listing".

  - Listing works for immutable releases; saving a release that is still mutable
    makes it immutable.
  - The form requires a description of fewer than 125 characters, which
    `check:actions` ensures.
  - If the form reports errors without showing any, save again.

## 0.2.4

### Patch Changes

- 88607f4: Request the Dependabot updates after a release in the runbook
  "Dependabot Pull Requests".

  - "Check for updates" for `github-actions` opens the pull requests for the new
    versions of own actions without waiting for the daily run.
  - The run and its log appear as the workflow "Dependabot Updates" in Actions.

## 0.2.3

### Patch Changes

- 9ac0cce: Document the Actions policy of the organization in the section "Trust
  Boundaries".

  - Only actions owned by GitHub and an allowlist of third-party actions can
    run, pinned by SHA.
  - A new third-party action needs an entry in the policy before its first run.

- 618bd7f: Switch on immutable releases in the action repositories and in
  `simbo-actions/.github`.

  - A published release and its tag are final; corrections are new patch
    versions.
  - The runbook "Failed Release" removes only versions whose release is still a
    draft.

- a779d0b: Turn off Actions in the action repositories and in
  `simbo-actions/.github`.

  - The repositories have no workflows.
  - The policy of the organization allows only selected actions, and GitHub
    rejected the previous repository setting `allowed_actions: all` with a
    conflict.

## 0.2.2

### Patch Changes

- 8d2d45c: Describe the repository of the organization profile as a collection
  published by an automated release process, as the new introduction does.
- fd876e4: Rewrite the introductions of the organization profile and the README
  with concrete statements about the standards and the release process.

## 0.2.1

### Patch Changes

- 50a66a7: Clarify which vulnerability scan blocks the merge and which blocks
  the release.
- 1e06401: Describe the approach of Simbo's Actions in the organization profile,
  the README, and the architecture.

  - A section "How It Works" in the organization profile and the README explains
    the constraints of GitHub Actions and how the monorepo separates source from
    distribution.
  - The architecture starts with "Approach" instead of "Why".
  - The section "About Simbo's Actions" of every action README comes from
    `tooling/about-section.md` and is checked by `check:actions`.

- 119b3af: Complete the documentation of changesets and required checks.

  - The troubleshooting entry for a missing changeset no longer suggests an
    empty changeset.
  - Document that Dependabot updates of workflow pins get no changeset.
  - Document why the vulnerability scan on `main` is not a required check.

- 5df5dde: Skip manual runs of the release workflow.

  - Only the dispatch by the checks on `main` starts a release, so a release
    cannot bypass failed checks.
  - Re-runs of a failed release still work, because they keep the actor of the
    original run.

- 7bea88e: Name the runs on `main` after their commit.

  - Release runs show the short SHA and the first line of the message of the
    checked commit.
  - Checks and Publish Organization runs on a push show the commit message.

- 850deaa: Remove the manual trigger of the publish workflow.

  - A failed publish is repeated by re-running its tag push run.
  - Resolves the code scanning alerts for cache poisoning: a manual run checked
    out a release tag in the cache scope of `main`.

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
