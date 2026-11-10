# 🔄 Simbo's Actions — Concept

The main goal of this monorepo setup is to develop all my GitHub Actions in a
centralized location while still publishing their build artifacts to separate
repositories.

```mermaid
graph LR
  Changeset["Changeset on <code>main</code>"]
  Release["Release workflow<br/>bump versions, changelogs"]
  MonorepoTag["Monorepo tag<br/><code>action-a/vX.Y.Z</code>"]
  Publish["Publish workflow<br/>build, copy artifacts"]
  ActionRepo["Action repository<br/><code>simbo-actions/action-a</code>"]
  ActionTag["Tag <code>vX.Y.Z</code>"]

  Changeset --> Release --> MonorepoTag --> Publish --> ActionRepo --> ActionTag
```

## Key Features

- **Native GitHub Actions versioning:** Each action is versioned independently
  with semantic versioning. Every release gets a tag `vX.Y.Z` in the action's
  repository. There are no moving tags such as `vX`, `vX.Y`, or `latest`.

- **Pinning by SHA:** Consumers pin an action by the commit SHA of a release
  tag, with the version as a comment, for example
  `simbo-actions/<ACTION>@<SHA> # vX.Y.Z`. Dependabot updates such pins.

- **No build artifacts in this repository:** The monorepo only contains the
  source code of the actions. The built artifacts are published to their
  respective repositories, keeping this repository clean and focused on relevant
  source code.

- **Streamlined publishing:** Actions are published automatically to their
  respective repositories upon adding new changesets, simplifying the
  distribution process and lowering maintenance overhead.

## Release Process

1. A push to `main` runs the "Checks" workflow. If changesets are present, it
   dispatches the "Release" workflow.
2. "Release" integrates the changesets, commits the version bumps and changelogs
   to `main`, and creates a tag `<action>/vX.Y.Z` per released package.
3. Each tag runs the "Publish" workflow. It builds the action, creates the
   action repository if necessary, replaces its content with the build
   artifacts, and creates the tag `vX.Y.Z` there.

Release and publish run as the GitHub App `simbo-actions[bot]`. Their jobs use
the environment `release`, which is limited to `main` and release tags. Every
step requests a token restricted to the repository and the permissions it needs.

## Requirements for Action Workspaces

To be compatible with the management and publishing process, each action
workspace must meet the following requirements:

- A `README.md` file documenting the action's purpose, usage, and examples.

- An `action.yml` file defining the action's metadata and inputs/outputs.

- A `package.json` file defining the action's workspace/package name, version,
  scripts, dependencies, etc. _(This is required even for non-Node.js actions to
  manage the workspace/package structure.)_

- If the action is implemented in JavaScript/TypeScript:
  - It should target Node.js 24 as the runtime environment.

### Scripts Called in Workflows

An action workspace's `package.json` may define the following scripts, which are
called in the workflows:

- `build` - builds the action's source code into a distributable format.
- `bundle` - run post-build bundling steps (e.g., copying additional files).
- `test` - runs tests for the action.
- `check` - run all other checks (linting, type checking, etc.).

### Build Artifacts Added to Published Repositories

The following files and directories are included in the published action
artifacts:

- `README.md`
- `action.yml`
- `package.json`
- `CHANGELOG.md` (automatically generated from changesets during releases)
- `LICENSE.md` (copied from the monorepo root)
- `dist/` directory (if exists after running the `build` and `bundle` scripts)
