# 🔄 Simbo's Actions — Development

How to set up, build, test, and change the actions in this monorepo.

- How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md)
- The requirements every change meets: [STANDARDS.md](STANDARDS.md)

## Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Repository Layout](#repository-layout)
- [Scripts](#scripts)
- [Making a Change](#making-a-change)
- [Writing Changesets](#writing-changesets)
- [Testing](#testing)
- [Adding an Action](#adding-an-action)
- [Releases](#releases)
- [Troubleshooting](#troubleshooting)

## Requirements

- macOS or Linux
- [Node.js](https://nodejs.org/) as in [`.nvmrc`](.nvmrc), for example via
  [nvm](https://github.com/nvm-sh/nvm).  
  The major version matches the runtime the GitHub Actions runner offers to
  actions (`node24`), see [ARCHITECTURE.md](ARCHITECTURE.md#nodejs-runtime).
- [pnpm](https://pnpm.io/) 12 (the exact version is set in `package.json` under
  `packageManager`; [Corepack](https://nodejs.org/api/corepack.html) picks it
  up)
- Git
- [osv-scanner](https://github.com/google/osv-scanner), for
  `pnpm run check:vulnerabilities`: `brew install osv-scanner`
- [Gitleaks](https://github.com/gitleaks/gitleaks), for `pnpm run check:secrets`
  and the pre-commit hook: `brew install gitleaks`.  
  Without it, the hook skips the scan with a warning; CI scans anyway.
- [actionlint](https://github.com/rhysd/actionlint) and
  [ShellCheck](https://www.shellcheck.net/), for `pnpm run check:workflows`:
  `brew install actionlint shellcheck`.  
  actionlint checks the scripts in workflows with ShellCheck only if it is
  installed.

## Setup

```sh
git clone git@github.com:simbo-actions/actions.git
cd actions
nvm install
pnpm install
pnpm run preflight
```

`pnpm run preflight` installs, builds, tests, and runs all checks, like the
workflow `checks` does.  
It ends with "All Checks Passed!".

## Repository Layout

```text
.
├── actions/
│   └── <name>/            one action: action.yml, src/, tests, README.md, LICENSE.md
├── changelog/             changelog of the monorepo itself
├── organization/          content of simbo-actions/.github: profile, community files
├── tooling/               monorepo checks and helpers, with tests
├── .changeset/            pending changesets
└── .github/
    ├── workflows/         checks, smoke-tests, release, publish,
    │                      publish-organization, security, automerge
    └── dependabot.yml     dependency updates
```

How the pieces work together is described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Scripts

Root scripts (run with `pnpm run <script>`):

| Script                   | What it does                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `preflight`              | Install, build, bundle, test, check, scan, and lint workflows                                                 |
| `each:build`             | Build all workspaces (Turbo)                                                                                  |
| `each:bundle`            | Run post-build bundling steps                                                                                 |
| `each:test`              | Run all tests with coverage                                                                                   |
| `each:check`             | Type check and lint all workspaces                                                                            |
| `check`                  | Format, boundaries, spelling, licenses, license files                                                         |
| `check:licenses`         | Check the licenses of the production dependencies of every action                                             |
| `check:vulnerabilities`  | Scan all dependencies with osv-scanner (needs a local installation)                                           |
| `check:secrets`          | Scan the Git history with Gitleaks (needs a local installation)                                               |
| `check:workflows`        | Lint all workflows with actionlint and ShellCheck (needs local installations)                                 |
| `check:actions`          | Check license files, README sections, Octokit copies, license lists, and that privileged jobs run no npm code |
| `fix:format`             | Format all files with Prettier                                                                                |
| `actions-list`           | Update the generated list of actions in the organization profile                                              |
| `ncu:patch`, `ncu:minor` | Update dependencies interactively                                                                             |
| `ncu:latest`             | Major updates interactively, without `@types/node`                                                            |

Workspace scripts (run inside a workspace, or with
`pnpm --filter <name> run <script>`):

| Script       | What it does                            |
| ------------ | --------------------------------------- |
| `build`      | Bundle the action into `dist/` (Rollup) |
| `test`       | Run the tests once, with coverage       |
| `test:watch` | Run the tests in watch mode             |
| `check`      | Type check and lint                     |
| `clean`      | Remove build and coverage output        |

## Making a Change

1. Create a branch.
2. Change the code, with tests and documentation.
3. Add a changeset:

   ```sh
   pnpm exec changeset
   ```

   Choose the affected actions and the version bump (patch, minor, major), and
   describe the change for the changelog, see
   [Writing Changesets](#writing-changesets).  
   Changes without a release of an action, for example to workflows, tooling, or
   the docs of the monorepo, get a changeset for the package `changelog`. There
   are no empty changesets.

4. Commit with a [Conventional Commits](https://www.conventionalcommits.org/)
   message with a scope, for example `fix(signed-commit): handle renamed files`
   or `docs(repo): …`.  
   A Git hook checks the message.
5. Run `pnpm run preflight`.
6. Open a pull request.

## Writing Changesets

Each changeset becomes one entry in the changelogs of its packages: the first
paragraph is the entry, everything after it is nested below.  
Keep the changelogs readable by writing changesets by topic:

- **Every pull request and every commit on `main` has at least one
  changeset.**  
  Use a changeset for an action when its published content changes for its
  users: behavior, inputs, outputs, bundled dependencies, its README.  
  Record everything else in a changeset for the private package `changelog`:
  workflows, tooling, docs of the monorepo, development dependencies, and
  refactorings without a change for users.  
  Never add empty changesets.
- **One topic per changeset.** If the summary needs an "and" to join two topics,
  write two changesets. One changeset may cover several packages, with different
  bump types, if the change is the same for all of them.
- **Start with a one-sentence summary in the imperative** that is readable on
  its own. List the details below it; every item belongs to that summary.
- **End with a paragraph on migration or impact** for major changes and for
  changes that can cause new errors.
- **Dependencies:** update a single dependency in one sentence
  (``Update `yaml` to ^2.9.1.``), several as `Update dependencies.` with a list
  of names and ranges.
- **Name the file after the topic,** for example `update-yaml.md`.

```md
---
'signed-commit': minor
---

Create a missing branch before committing.

- The input `create-branch` creates the branch at `base`, by default the head of
  the default branch.
- With `sync`, the local checkout switches to the new branch.
```

To preview the changelog entries, run `pnpm exec changeset version` in a
temporary worktree of the last commit and look at the diff of the `CHANGELOG.md`
files.

## Testing

- Tests use [Vitest](https://vitest.dev/) and live next to the code as
  `*.test.ts`.
- Every workspace enforces at least 90 % line, statement, function, and branch
  coverage.  
  `pnpm run test` fails below that.
- Test behavior, not implementation: one test per behavior and per error case,
  with meaningful assertions.
- Code that runs Git is tested against temporary Git repositories (see
  `actions/signed-commit/tests/git-fixture.ts`).
- Code that calls the GitHub API is tested with a fake Octokit client.  
  No test calls the real API, except the smoke tests in the workflow
  `smoke-tests`: read-only tests on every pull request, and write tests against
  `simbo-actions/sandbox`, see
  [ARCHITECTURE.md](ARCHITECTURE.md#integration-tests).

### Testing Against the Sandbox

Actions that write are tested against the real API in
[`simbo-actions/sandbox`](https://github.com/simbo-actions/sandbox), also while
they are developed:

1. Push the branch and open a pull request in this repository.
2. The write tests wait for approval: in the pull request, open the run of
   `checks` and choose **Review deployments**, then approve `smoke-test-pr`.  
   Read the changes of the pull request first; its code runs with the key of the
   sandbox app.
3. The results are in the job summaries and logs of the jobs `*-sandbox`.  
   Every push to the pull request starts a new run, which needs a new approval.

Pull requests from forks and Dependabot do not run the write tests; a maintainer
tests the change on a branch of this repository.

## Adding an Action

1. Check that the name is free in the GitHub Marketplace:
   `https://github.com/marketplace/actions/<name>` must not exist, and no user
   or organization may have that name (`gh api users/<name>` fails).
2. Create `actions/<name>/`, for example by copying the structure of
   [`actions/github-app-bot-user`](actions/github-app-bot-user/README.md):
   `action.yml`, `package.json`, `src/`, `eslint.config.js`, `rollup.config.js`,
   `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`.  
   If the action uses the GitHub API, copy `src/create-octokit.ts` and its test
   unchanged, and create the API client with `createOctokit`.
3. In `package.json`, set `name` to the folder name, a `description`, and
   `"version": "0.0.0"`.  
   The action is published to `simbo-actions/<name>`.
4. Add `LICENSE.md` with the current year, and link it in the README as
   `https://simbo.mit-license.org/@<year>`.
5. Start the README with the note about the monorepo (copy it from another
   action).
6. Write the README with all sections required by [STANDARDS.md](STANDARDS.md).
7. Write the code and tests.  
   Report the result in the job summary in the style of the other actions, and
   name Linux runners in **Limitations**.  
   Add a job for it to [`smoke-tests.yml`](.github/workflows/smoke-tests.yml):
   it downloads the built actions, runs the action with
   `uses: ./smoke/actions/<name>`, and checks its outputs, with only the
   permissions the test needs.  
   An action that writes is tested in a job `<name>-sandbox`, like the existing
   ones: the same condition and environment, a token of the sandbox app, names
   with the run ID, no npm code, and a cleanup step that runs also on failure.  
   Add the new checks to the required checks of the ruleset "Main Branch".
8. Add a changeset with a major bump for the first release (1.0.0), and run
   `pnpm run actions-list`.

The first release creates the repository `simbo-actions/<name>` and configures
it automatically.

## Releases

Releases are fully automated: a merged pull request with a changeset starts the
release, and every released action is published to its repository.  
See [ARCHITECTURE.md](ARCHITECTURE.md#from-changeset-to-release).

## Troubleshooting

| Problem                                               | Solution                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ERR_PNPM_OUTDATED_LOCKFILE` with `--frozen-lockfile` | Run `pnpm install` and commit `pnpm-lock.yaml`                                         |
| A new package version is not installed                | pnpm installs versions only after a minimum age of two days (`minimumReleaseAge`)      |
| Commit rejected with a commitlint error               | Use a Conventional Commits message, for example `feat(<scope>): …`                     |
| Tests fail with a coverage threshold error            | Add tests for the uncovered code; the report is in `coverage/`                         |
| `check:licenses` fails                                | The dependency's license is not allowed, see [STANDARDS.md](STANDARDS.md#dependencies) |
| The workflow `checks` fails on "Missing Changeset"    | Add a changeset, or an empty one for changes without a release                         |
