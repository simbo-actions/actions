# 🔄 Simbo's Actions — Architecture

How this monorepo develops, releases, and publishes GitHub Actions, and how it
manages the action repositories in the organization
[`simbo-actions`](https://github.com/simbo-actions).

For the quality and security requirements, see [STANDARDS.md](STANDARDS.md). For
local development, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Contents

- [Overview](#overview)
- [Repositories](#repositories)
- [From Changeset to Release](#from-changeset-to-release)
- [Publishing an Action](#publishing-an-action)
- [Managing Action Repositories](#managing-action-repositories)
- [Identity, Tokens, and Permissions](#identity-tokens-and-permissions)
- [Trust Boundaries](#trust-boundaries)
- [Tags and Versions](#tags-and-versions)
- [Dependency Updates](#dependency-updates)
- [Rate Limits](#rate-limits)
- [Design Decisions](#design-decisions)

## Overview

All actions are developed in one place and published to repositories of their
own. Consumers only use the action repositories, pinned by commit SHA.

```mermaid
flowchart LR
  subgraph monorepo["simbo-actions/actions (monorepo)"]
    source["actions/NAME/<br/>source, tests, docs"]
    tooling["tooling/<br/>release scripts"]
    workflows[".github/workflows/<br/>checks, release, publish"]
  end

  bot(["simbo-actions[bot]<br/>GitHub App"])

  subgraph org["organization simbo-actions"]
    repoA["simbo-actions/signed-commit<br/>build artifacts, tags, releases"]
    repoB["simbo-actions/github-app-bot-user<br/>build artifacts, tags, releases"]
  end

  consumer["consumer workflows<br/>uses: simbo-actions/NAME@SHA"]

  source --> workflows
  tooling --> workflows
  workflows -- "runs as" --> bot
  bot -- "creates, configures,<br/>publishes" --> repoA
  bot -- "creates, configures,<br/>publishes" --> repoB
  repoA --> consumer
  repoB --> consumer
```

## Repositories

| Repository               | Contains                                                                         | Changed by                           |
| ------------------------ | -------------------------------------------------------------------------------- | ------------------------------------ |
| `simbo-actions/actions`  | Source, tests, and docs of all actions; tooling; workflows                       | Maintainers and contributors via PRs |
| `simbo-actions/<action>` | Build artifacts of one action: `action.yml`, `dist/`, README, changelog, license | Only the publish workflow            |

The action repositories have issues, wiki, and projects disabled. Issues and
contributions go to the monorepo.

Workspaces in the monorepo:

| Workspace         | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `actions/<name>/` | One action: `action.yml`, `src/`, tests, README, `LICENSE.md` |
| `tooling/`        | Scripts for checks, release, and publish, with tests          |
| `changelog/`      | Changelog of the monorepo itself                              |

An action is published only if its `package.json` names the target repository in
`actionRepository`, for example
`"actionRepository": "simbo-actions/signed-commit"`.

## From Changeset to Release

Every change to an action comes with a changeset. A push to `main` with
changesets starts the release automatically.

```mermaid
sequenceDiagram
  autonumber
  actor dev as Maintainer
  participant main as main branch
  participant checks as Checks workflow
  participant release as Release workflow
  participant publish as Publish workflow

  dev->>main: merge pull request with changeset
  main->>checks: push event
  checks->>checks: build, test, lint, smoke tests
  checks->>release: dispatch (GITHUB_TOKEN, actions: write)
  release->>release: changeset version
  release->>main: signed commit "ci(release): …"
  release->>main: tag ACTION/vX.Y.Z (one API call per tag)
  main->>publish: push event per tag
  publish->>publish: publish one action (see next section)
```

The release commit and the tags are created via the GitHub API with
[`signed-commit`](actions/signed-commit/README.md), so they are verified. The
tag `changelog/vX.Y.Z` of the monorepo changelog starts no publish run.

## Publishing an Action

One publish run per tag `<action>/vX.Y.Z`. A first job without secrets decides
whether the action is published at all.

```mermaid
flowchart TD
  tag(["tag ACTION/vX.Y.Z"]) --> target

  subgraph job1["job: target (no secrets)"]
    target["read actionRepository<br/>from package.json at the tag"]
  end

  target -- "not set" --> skip(["publish job skipped"])
  target -- "simbo-actions/ACTION" --> build

  subgraph job2["job: publish (environment release)"]
    build["checkout at tag (no stored credentials)<br/>install, build, bundle"]
    assemble["assemble content and assets<br/>ACTION-vX.Y.Z.tar.gz, SHA256SUMS,<br/>release notes from changelog"]
    attest["attest build provenance<br/>(Sigstore, stored in the monorepo)"]
    exists{"repository<br/>exists?"}
    create["create repository<br/>auto_init, description"]
    configure["apply settings and rulesets<br/>(only what differs)"]
    commit["replace content<br/>signed commit + tag vX.Y.Z"]
    draft["create draft release<br/>upload assets"]
    published(["publish release"])

    build --> assemble --> attest --> exists
    exists -- no --> create --> configure
    exists -- yes --> configure
    configure --> commit --> draft --> published
  end
```

All third-party code (install, build) runs before the first app token is
requested. Each later step requests its own token, see
[Identity, Tokens, and Permissions](#identity-tokens-and-permissions).

Release assets and how to verify them:

| Asset                          | Content                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `<action>-vX.Y.Z.tar.gz`       | The published content of the release                         |
| `SHA256SUMS`                   | SHA-256 checksum of the archive                              |
| Build provenance (attestation) | Signed statement that the archive was built by this workflow |

```sh
gh attestation verify signed-commit-v1.0.0.tar.gz --repo simbo-actions/actions
```

## Managing Action Repositories

The publish process owns the action repositories. It creates a missing
repository and, on every publish, compares its settings with the standard and
corrects what differs. Manual changes in an action repository are reset by the
next publish.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Missing
  Missing --> Created: create with auto_init<br/>(verified initial commit)
  Created --> Configured: apply settings and rulesets
  Configured --> Published: signed commit, tag, release
  Published --> Drifted: manual change
  Drifted --> Configured: next publish<br/>corrects the difference
  Published --> Configured: next publish<br/>(nothing to change)
```

Settings applied to every action repository:

| Area                   | Setting                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| General                | Issues, wiki, and projects off; description from `package.json`; homepage is the monorepo                                                           |
| Merge                  | Squash only, auto-merge allowed, update branch suggested, branches deleted after merge                                                              |
| Security               | Secret scanning with push protection, Dependabot alerts, private vulnerability reporting on                                                         |
|                        | Dependabot security updates and code scanning off: the content is generated and overwritten by every publish; the source is scanned in the monorepo |
| Actions                | SHA pinning required, `GITHUB_TOKEN` read-only, no pull request approvals                                                                           |
| Ruleset "Main Branch"  | No deletion, no force push, linear history, signed commits, pull requests with squash only                                                          |
| Ruleset "Release Tags" | `v*.*.*`: creating, updating, and deleting only via bypass                                                                                          |
| Bypass                 | The app `simbo-actions` and organization admins                                                                                                     |
| Releases               | Immutable releases (switched on once the process is established)                                                                                    |

## Identity, Tokens, and Permissions

Release and publish run as the GitHub App `simbo-actions[bot]`. Its private key
lives in the environment `release`, which only `main` and release tags can use.
Every step requests its own token, restricted to one repository and the
permissions it needs.

| Step                             | Token          | Repository        | Permissions                              |
| -------------------------------- | -------------- | ----------------- | ---------------------------------------- |
| Checks (all jobs except below)   | `GITHUB_TOKEN` | monorepo          | `contents: read`                         |
| Dispatch release                 | `GITHUB_TOKEN` | monorepo          | `actions: write`                         |
| Release commit and tags          | app token      | monorepo          | `contents: write`                        |
| Changeset for dependency updates | app token      | monorepo          | `contents: write`                        |
| Create action repository         | app token      | monorepo (scope)  | `administration: write`, only if missing |
| Configure action repository      | app token      | action repository | `administration: write`                  |
| Commit, tag, release             | app token      | action repository | `contents: write`                        |
| Build provenance                 | `GITHUB_TOKEN` | monorepo          | `id-token: write`, `attestations: write` |

```mermaid
flowchart LR
  key[("private key<br/>environment release")] --> token["actions/create-github-app-token<br/>one token per step"]
  token -- "contents: write<br/>monorepo" --> release["release commit, tags"]
  token -- "administration: write<br/>action repository" --> configure["settings, rulesets"]
  token -- "contents: write<br/>action repository" --> publish["commit, tag, release"]
```

Tokens are revoked at the end of each job. No Git credentials are stored in a
checkout; commits and tags are created via the API.

## Trust Boundaries

| Context                                                   | Secrets | Can write to                               |
| --------------------------------------------------------- | ------- | ------------------------------------------ |
| Pull requests, Dependabot, forks                          | none    | nothing (read-only `GITHUB_TOKEN`)         |
| Push to `main` (checks)                                   | none    | dispatches the release only                |
| Jobs with environment `release` on `main` or release tags | app key | monorepo and action repositories, per step |
| Organization admins                                       | –       | everything, via ruleset bypass             |

Fork pull requests need approval before their workflows run. The rulesets apply
to all automation; only the app and organization admins bypass them.

## Tags and Versions

| Where             | Tag                | Created by       |
| ----------------- | ------------------ | ---------------- |
| Monorepo          | `<action>/vX.Y.Z`  | Release workflow |
| Monorepo          | `changelog/vX.Y.Z` | Release workflow |
| Action repository | `vX.Y.Z`           | Publish workflow |

- Every action is versioned independently with semantic versioning.
- There are no moving tags such as `vX`, `vX.Y`, or `latest`. Consumers pin the
  commit SHA of a release tag, with the version as a comment; Dependabot updates
  such pins.
- Release tags are protected by the ruleset "Release Tags". With immutable
  releases, a published version is final.

## Dependency Updates

Dependabot proposes updates; what is merged automatically depends on the risk.

```mermaid
flowchart TD
  pr(["Dependabot pull request"]) --> kind{"what changes?"}
  kind -- "simbo-actions/*" --> auto["auto-merge after checks"]
  kind -- "actions/*, github/*<br/>minor or patch" --> auto
  kind -- "other actions, majors" --> owner["assigned to the owner"]
  kind -- "npm, weekly group" --> owner
  owner --> merged(["merged by the owner"])
  auto --> merged
  merged -- "npm dependencies changed" --> changeset["job dependency-changeset:<br/>patch changeset for affected actions"]
  changeset --> releaseFlow(["release and publish"])
```

Updates of third-party actions and npm packages wait 7 days after their release
(cooldown). Dependabot pull requests never receive secrets; the changeset for
npm updates is created after the merge, in a job with the environment `release`.

## Rate Limits

All API requests of release and publish run as `simbo-actions[bot]` and share
its rate limits, also across parallel runs. Requests that hit a rate limit are
retried after the wait time GitHub asks for, both in `signed-commit` and in the
tooling. Settings of action repositories are written only where they differ, to
save write requests.

## Design Decisions

- **One publish run per tag.** Why: every action publishes independently and can
  be re-run on its own. Large releases share rate limits; a matrix with
  `max-parallel` is the option if that becomes a problem.
- **Commits and tags via the API.** Why: commits by a GitHub App are verified
  only when GitHub creates them; tags created one by one each trigger their own
  event.
- **Repositories created with `auto_init`.** Why: the initial commit is created
  by GitHub and verified. Creating repositories from a template repository is an
  option if they should start with fixed files; settings and rulesets would
  still be applied by the publish process.
- **One `LICENSE.md` per action.** Why: the copyright year is the year an action
  was first published; a shared file would change the year of older actions.
- **Settings enforced on every publish.** Why: action repositories are
  generated; drift is corrected automatically instead of documented.
