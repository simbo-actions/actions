# 🔄 Simbo's Actions — Standards

The actions in this repository are built for production use in
security-conscious organizations:

- least privilege
- a pinned and verified supply chain
- tested behavior
- complete documentation
- reproducible releases

This document is the measure every action and every change is held against.  
It has two parts: the [core](#core), which applies to everything in this
repository, and the [profile for GitHub Actions](#profile-github-actions).

- **Required** means: every published action meets it, from version 1.0.0 on.
  Changes that would break a requirement are not merged.
- **Target** means: planned, not yet required.
- **No exceptions.** Code that does not meet the standard is fixed or removed,
  not exempted.
- **Strictness follows permissions.** Jobs with secrets or write access
  (release, publish) meet every requirement to the letter. Read-only jobs
  without secrets, such as scanners, may use the recommended setup of a
  [trusted publisher](#dependencies); remaining risks are documented in
  [ARCHITECTURE.md](ARCHITECTURE.md).

The standard follows established frameworks without claiming certification:

- [OpenSSF Best Practices](https://www.bestpractices.dev/)
- [OpenSSF Scorecard](https://scorecard.dev/)
- [SLSA Build Level 2](https://slsa.dev/spec/v1.0/levels)
- GitHub's
  [security hardening for GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)

## Contents

- [Core](#core)
  - [Security](#security)
  - [Supply Chain](#supply-chain)
  - [Code and Tests](#code-and-tests)
  - [Behavior](#behavior)
  - [Compatibility and Versioning](#compatibility-and-versioning)
  - [Documentation](#documentation)
  - [Dependencies](#dependencies)
  - [Maintenance](#maintenance)
  - [Open Source](#open-source)
- [Profile: GitHub Actions](#profile-github-actions)
- [Targets](#targets)
- [How the Standard Is Enforced](#how-the-standard-is-enforced)

## Core

### Security

Required:

- Every token has the least permissions and the fewest repositories its step
  needs. Workflows set `permissions: {}` at the top level and grant permissions
  per job.
- Inputs, secrets, and other untrusted values reach scripts only via environment
  variables, never via `${{ }}` inside a script.
- No secrets in pull request workflows. Jobs that need secrets use the
  environment `release` and run only on `main` or release tags.
- No own cryptography: tokens, signatures, and hashes come from established
  libraries or GitHub.
- Automation acts through a dedicated GitHub App with the least installation
  permissions. Every permission is justified in
  [ARCHITECTURE.md](ARCHITECTURE.md#github-app) and added only together with the
  step that needs it.
- All dependencies are scanned for known vulnerabilities and malicious packages
  on every pull request (new findings fail), every push to `main`, and weekly.
  Findings are fixed or accepted with a reason and an expiry date.
- The whole Git history is scanned for secrets with Gitleaks on every pull
  request and every push to `main`, and staged changes before every commit where
  Gitleaks is installed. A found secret is revoked first, then removed.
- Secret scanning with push protection, code scanning (CodeQL), Dependabot
  alerts, and private vulnerability reporting are on.
- Vulnerabilities are reported privately, see [SECURITY.md](SECURITY.md).

### Supply Chain

Required:

- All commits and tags on `main` and in action repositories are verified.
  Automation creates them via the GitHub API.
- Releases are created only by CI, from a release tag, never by hand.
- Every release has assets with a `SHA256SUMS` file and **build provenance**
  (artifact attestation, SLSA Build Level 2).
- Third-party actions are pinned by full commit SHA, with the version as a
  comment. Own actions in this repository are used via `./actions/<name>`.
- Tools downloaded in workflows or actions are pinned by version and verified by
  checksum. In read-only jobs without secrets, an action of a trusted publisher
  may download its tool itself.
- Floating tags: only `vX`, only created and moved by the release process, only
  forward to the highest stable version of the major version, never to a
  prerelease. No `vX.Y` or `latest`. Documentation recommends pinning by SHA and
  offers `@vX` as convenience.
- Immutable releases: a published version is final; corrections are new patch
  releases.

### Code and Tests

Required:

- TypeScript with `strict` settings, type checked, linted with zero warnings,
  formatted with Prettier.
- Unit tests for all logic, with at least **90 %** line, statement, function,
  and branch coverage, enforced in CI. This applies to all TypeScript in the
  repository, including [`tooling/`](tooling/README.md).
- Every behavior and every error case has its own test with a meaningful
  assertion. Coverage is a lower bound, not the goal.
- Smoke tests against the real GitHub API where they work without secrets.

### Behavior

Required:

- All inputs are validated; invalid values fail with a clear message instead of
  a silent fallback.
- Error messages say what went wrong and how to fix it.
- API requests that hit a rate limit are retried after the wait time GitHub asks
  for.
- Operations are idempotent where possible, so a failed run can be repeated.
- Nothing is overwritten unintentionally, for example a branch that moved.

### Compatibility and Versioning

Required:

- [Semantic versioning](https://semver.org/) per action. Breaking changes only
  in a major version, described in the changelog.
- Deprecations are announced in a minor version before the removal.
- The GitHub Actions runner sets the Node.js version: actions use the newest
  runtime it offers (`node24`), and development, CI, and `@types/node` use the
  same major version. A runtime change is a major version of every action.
- Limitations are documented.

### Documentation

Required:

- Every action has a README that starts with a note that the action is developed
  in this monorepo and published automatically.  
  It has these sections, checked in CI (`pnpm run check:actions`):
  - purpose (introduction)
  - **How It Works**
  - **Usage** (pinned by SHA)
  - **Examples**
  - **Inputs**
  - **Outputs**
  - **Token and Permissions**
  - **Security**
  - **Limitations**
  - **License**
- Every change to an action comes with a changeset; the changelog and the
  release notes are generated from it.
- Architecture, development, and contribution are documented in
  [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT.md](DEVELOPMENT.md), and
  [CONTRIBUTING.md](CONTRIBUTING.md).
- Documentation is easy to scan:
  - one topic per paragraph;
  - sentences that belong together but stand on their own each start a new line,
    with a hard line break (two trailing spaces);
  - enumerations of three or more items are lists.

### Dependencies

A dependency becomes part of every action that bundles it.  
New dependencies are added only if they meet these criteria; the reasons are
noted in the pull request.

Required:

- **Necessary:** it solves something that cannot be built cleanly with
  reasonable effort, or that must not be built by ourselves (cryptography).
- **License:** two lists apply, both checked in CI.

  | Dependencies                      | Allowed licenses                                                                                                    | Checked by                       |
  | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
  | Bundled (production dependencies) | `0BSD`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MIT`                                                  | `pnpm run check:licenses`        |
  | All, including development tools  | additionally `BlueOak-1.0.0`, `CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `MPL-2.0`, `Python-2.0`, `WTFPL` | `pnpm run check:vulnerabilities` |

  Strong copyleft (GPL, AGPL, LGPL) is not allowed anywhere.

- **Maintained:** active maintenance, an identifiable maintainer or
  organization, no abandoned packages.
- **Behavior:** no install scripts (pnpm blocks them), no network access on
  import, no telemetry.
- **Small:** few transitive dependencies.
- **Locked:** versions are locked in `pnpm-lock.yaml`; new versions are
  installed only after a minimum age of two days. Security fixes of indirect
  dependencies are set as `overrides` in `pnpm-workspace.yaml` until their
  dependents require them.

Preferred:

- Packages published with npm provenance.
- For actions: actions of **trusted publishers** over others. Trusted publishers
  are `actions/*`, `github/*`, and `google/*`; their minor and patch updates are
  merged automatically. Other actions are used only after a review, and every
  update is reviewed.

### Maintenance

Required:

- Dependency updates by risk:

  | Update                                        | Handling                                                                                  |
  | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
  | `simbo-actions/*`                             | reviewed and merged by a maintainer (they run with credentials in this repository)        |
  | Trusted publishers (minor, patch)             | merged automatically after checks and 7 days cooldown                                     |
  | Other actions, major updates of actions       | reviewed and merged by a maintainer                                                       |
  | npm minor and patch (weekly, 7 days cooldown) | reviewed and merged by a maintainer; the changeset is added automatically after the merge |
  | npm major updates                             | no Dependabot pull requests; planned and done by hand, monthly                            |
  | Security updates                              | reviewed and merged by a maintainer, promptly                                             |

- Fixed vulnerabilities in bundled dependencies are shipped with a new patch
  release.
- Recurring tasks follow the runbooks in [MAINTAINING.md](MAINTAINING.md).
- Support policy and supported versions: [SUPPORT.md](SUPPORT.md) and
  [SECURITY.md](SECURITY.md).

### Open Source

Required:

- MIT license. Every action has its own `LICENSE.md` with the year of its first
  release; its README links the license with the same year.
- **One place for the community:** issues, pull requests, discussions, security
  reports, and the community files ([CONTRIBUTING.md](CONTRIBUTING.md),
  [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md),
  [SUPPORT.md](SUPPORT.md), issue and pull request templates) are in this
  repository only.
- **Generated repositories accept nothing:** the action repositories and the
  organization repository `simbo-actions/.github` are written only by the
  publish process. They have issues, pull requests, discussions, wiki, and
  projects disabled; every action README starts with a note that points to this
  repository.
- [Conventional Commits](https://www.conventionalcommits.org/), checked by
  commitlint.

## Profile: GitHub Actions

### Kinds of Actions

| Kind                        | Use                                                        | Tests                                                              |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Node.js action (TypeScript) | The default; all own logic                                 | Unit tests with 90 % coverage; smoke tests where possible          |
| Composite action            | Only to compose other actions (`uses:`), without own logic | Workflow tests in `checks` for every input, output, and error case |
| Docker or shell action      | Not used                                                   | –                                                                  |

A composite action passes values between other actions.  
As soon as it would branch, compute, or parse, that logic belongs into a tested
Node.js action.

Unavoidable glue in `run:` steps is a few lines, gets its inputs via `env`, and
uses `set -euo pipefail`.

### Workflows

Required:

- `permissions: {}` at the top level, permissions per job.
- No `pull_request_target`; workflows on pull requests never receive secrets.
- Checkouts use `persist-credentials: false` unless a later step pushes with
  Git.
- Third-party code (install, build) never runs in a job with credentials.  
  A build job without environment and secrets hands its result over as artifact;
  the privileged job with the environment `release` only runs prebuilt actions.
  Checked in CI (`pnpm run check:actions`).
- All workflows and `action.yml` files pass
  [actionlint](https://github.com/rhysd/actionlint) with ShellCheck.
- Jobs must not fail on Dependabot branches; jobs with secrets run only on
  `main` or release tags.

### Releases

Required:

- Every action in `actions/<name>` is published to the repository
  `simbo-actions/<name>`; there are no unpublished actions.
- The name of every published action is free in the
  [GitHub Marketplace](https://github.com/marketplace?type=actions): no action,
  user, or organization with that name exists. The action repository meets the
  Marketplace requirements (one `action.yml` at the root, no workflow files).
- Release content: `action.yml`, `dist/` (if any), `README.md`, `CHANGELOG.md`,
  `LICENSE.md`, `package.json`.
- Release order: build, attest, draft release, upload assets, publish.

## Targets

Planned, not yet required:

- [OpenSSF Scorecard](https://scorecard.dev/) on a schedule, with a published
  score.
- [OpenSSF Best Practices badge](https://www.bestpractices.dev/), level
  "passing".
- Integration tests with a GitHub App token on `main`, for actions that need
  write access.
- A stated response time for security reports.

## How the Standard Is Enforced

| Requirement                                  | Enforced by                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Types, lint, format, spelling                | `pnpm run each:check`, `pnpm run check` in the workflow `checks`                                     |
| Tests and coverage                           | `pnpm run each:test` (Vitest thresholds)                                                             |
| Workflows and `action.yml`                   | actionlint with ShellCheck in `checks`                                                               |
| Licenses of bundled dependencies             | `pnpm run check:licenses` (license-checker-rseidelsohn)                                              |
| Vulnerabilities, all licenses                | osv-scanner workflows of Google in `checks` and `security`; locally `pnpm run check:vulnerabilities` |
| Secrets in the Git history                   | `gitleaks-scan` in `checks`; locally `pnpm run check:secrets` and the pre-commit hook                |
| License file, README sections, monorepo note | `pnpm run check:actions`, also checks that all license lists match                                   |
| Changeset per change                         | `checks` on pull requests                                                                            |
| Pinned actions                               | Actions setting "require SHA pinning"                                                                |
| Verified commits                             | Ruleset "Main Branch" (signed commits)                                                               |
| Protected release and floating tags          | Ruleset "Release Tags" (`v*`)                                                                        |
| Review                                       | Pull requests with required checks; [CONTRIBUTING.md](CONTRIBUTING.md) checklist                     |
