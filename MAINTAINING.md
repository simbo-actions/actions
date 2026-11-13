# 🔄 Simbo's Actions — Maintaining

Runbooks for the recurring tasks of maintainers. Every runbook has a trigger and
steps to follow. For how things work, see [ARCHITECTURE.md](ARCHITECTURE.md);
for the requirements, see [STANDARDS.md](STANDARDS.md).

Commands are run from the repository root unless noted otherwise.

## Overview

| Task                                                                | When                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| [Dependabot pull requests](#dependabot-pull-requests)               | weekly, or when assigned                              |
| [Scanner findings](#scanner-findings)                               | `checks` or `security` fails on osv-scanner           |
| [Secret found](#secret-found)                                       | `checks` or the pre-commit hook fails on Gitleaks     |
| [Expiring accepted findings](#expiring-accepted-findings)           | monthly                                               |
| [Pinned tools](#pinned-tools)                                       | monthly                                               |
| [Security fixes as overrides](#security-fixes-as-overrides)         | monthly                                               |
| [Marketplace listing](#marketplace-listing)                         | after a release                                       |
| [Failed release](#failed-release)                                   | when release or publish fails                         |
| [Settings of action repositories](#settings-of-action-repositories) | when a setting should change                          |
| [Organization profile](#organization-profile)                       | when the organization should be presented differently |
| [Security reports](#security-reports)                               | when a report arrives                                 |
| [Pull requests from forks](#pull-requests-from-forks)               | when a contributor opens one                          |
| [App private key](#app-private-key)                                 | yearly, and immediately if it may have leaked         |
| [App permissions](#app-permissions)                                 | when a step needs a new permission                    |
| [Node.js runtime](#nodejs-runtime)                                  | when GitHub announces a new runtime                   |
| [New major version](#new-major-version)                             | with every major release                              |

## Dependabot Pull Requests

Low-risk updates are merged automatically (see
[STANDARDS.md](STANDARDS.md#maintenance)); all others are assigned to the owner.

1. Open the assigned pull requests.
2. For every update, read the release notes or changelog of the new versions.
   Look for breaking changes, new permissions, new network access, and
   unexpected maintainers.
3. Wait for `checks`. If it fails, fix the cause on the branch or close the pull
   request with a reason.
4. Merge with squash.
5. For npm updates, the job `dependency-changeset` adds the changeset after the
   merge; check that the release starts.

## Scanner Findings

osv-scanner reports a vulnerability, a malicious package, or a license that is
not allowed.

1. Reproduce locally: `pnpm run check:vulnerabilities` (needs
   `brew install osv-scanner`).
2. **Malicious package:** remove it immediately, check where it came from, and
   treat the event as a [security report](#security-reports).
3. **Vulnerability with a fixed version:**
   1. Update the direct dependency: `pnpm up -r <package>`.
   2. If only an indirect dependency is affected and its dependent does not
      allow the fix yet, add an override to `pnpm-workspace.yaml`, limited to
      the vulnerable range, for example `fast-uri@>=3.0.0 <3.1.9: ^3.1.9`.
   3. Run `pnpm install` and `pnpm run preflight`.
4. **Vulnerability without a usable fix:** if the package is not bundled and the
   vulnerable code path is not reachable, add an entry to `osv-scanner.toml`
   with the ID, a reason, and `ignoreUntil` at most three months ahead.
   Otherwise, replace the dependency.
5. **License not allowed:** replace the dependency, or, for a development tool
   with an acceptable license, extend the list in `check:vulnerabilities` and in
   [STANDARDS.md](STANDARDS.md#dependencies) in the same pull request.
6. Add a changeset if bundled code changes.

## Secret Found

Gitleaks reports a potential secret, as annotation in `checks` or in the
pre-commit hook. The value is redacted everywhere.

1. Find the location in the annotation or the job summary of `checks`, or run
   `gitleaks git -v --redact` locally.
2. **Real secret:** revoke or rotate it at its provider **first**; a pushed
   secret is compromised, also in a fork. Then remove it from the code. If it
   reached `main`, check the audit log and the provider for misuse, and treat
   the event as a [security report](#security-reports).
3. **False positive:** add the fingerprint that `gitleaks git -v` prints to
   `.gitleaksignore`, with a comment why, in the same pull request.

## Expiring Accepted Findings

1. Open `osv-scanner.toml` and check every `ignoreUntil`.
2. For entries expiring within the next month, check whether a fix exists now
   and follow [Scanner findings](#scanner-findings).
3. Remove entries that are no longer needed.

## Pinned Tools

Dependabot does not update tools downloaded by workflows or built into actions.
osv-scanner is not pinned here: Google's workflows bring it, and Dependabot
updates them.

| Tool       | Pinned in                                                                                                                      | Releases                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| actionlint | `.github/workflows/checks.yml` (Linux amd64)                                                                                   | [rhysd/actionlint](https://github.com/rhysd/actionlint/releases)   |
| Gitleaks   | [`actions/gitleaks-scan/src/gitleaks-scan-constants.ts`](actions/gitleaks-scan/src/gitleaks-scan-constants.ts) (all platforms) | [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks/releases) |

1. Check the latest release. Use it only if it is at least 7 days old.
2. Read the release notes.
3. Take the SHA-256 checksums from the release's checksum file, for example:

   ```sh
   gh release download v8.30.1 -R gitleaks/gitleaks -p 'gitleaks_*_checksums.txt' -O - | grep -E '(linux|darwin)_(x64|arm64)'
   ```

4. Update the version and the checksums where the tool is pinned.
5. For Gitleaks, add a patch changeset for `gitleaks-scan`; the new version
   reaches all repositories with the next release of the action.
6. Update the local installations
   (`brew upgrade actionlint gitleaks osv-scanner shellcheck`).

## Security Fixes as Overrides

1. Open `overrides` in `pnpm-workspace.yaml`.
2. For every entry, check whether the dependents now require the fixed version
   (`pnpm why -r <package>`).
3. Remove entries that are no longer needed, run `pnpm install` and
   `pnpm run check:vulnerabilities`.

## Marketplace Listing

Not every version needs to be listed; list at least every new major version and
new actions.

1. Open the release in the action repository, for example
   `https://github.com/simbo-actions/<action>/releases`.
2. Edit the release and check "Publish this Action to the GitHub Marketplace".
3. Choose the categories and save.

## Failed Release

1. Open the failed run of `release` or `publish` and find the failing step.
2. **Before the release commit:** fix the cause on `main`; the next push with
   the changesets starts the release again.
3. **After the tags were created:** re-run the failed publish run. Publishing is
   idempotent: settings are applied again, an unchanged content creates no
   commit, and leftover draft releases are removed.
4. **If a version must be withdrawn:** this is possible only while immutable
   releases are off. Delete the release and the tags (`<action>/vX.Y.Z` in the
   monorepo, `vX.Y.Z` in the action repository) as organization admin. With
   immutable releases on, publish a new patch version instead.

## Settings of Action Repositories

1. Change
   [`.github/managed-repository-settings.json`](.github/managed-repository-settings.json)
   in a pull request, with a changeset (`--empty` if no action changes).
2. Every following publish applies the settings. To apply them to all action
   repositories at once, run `apply-repository-settings` with `dry-run: true`
   first and check the changes.
3. Document the change in
   [ARCHITECTURE.md](ARCHITECTURE.md#managing-action-repositories).

## Organization Profile

1. Change the files in [`organization/`](organization/README.md); the list of
   actions in `organization/profile/README.md` is updated with
   `pnpm run actions-list`.
2. Merge to `main`. The workflow `publish-organization` publishes the content to
   `simbo-actions/.github`.
3. Check the profile on
   [github.com/simbo-actions](https://github.com/simbo-actions).

## Security Reports

1. Acknowledge the report in the private advisory within 7 days.
2. Reproduce and assess the impact.
3. Fix it in a temporary private fork of the advisory, then release a new
   version.
4. Publish the advisory with the fixed versions and credit the reporter, unless
   they prefer not to be credited.

## Pull Requests from Forks

Workflows of pull requests from forks need approval.

1. Read the changes, especially workflows, scripts, and dependencies, before
   approving the run.
2. Approve the workflow run in the pull request.

## App Private Key

The private key of the GitHub App `simbo-actions` lives in the environment
`release` as `SIMBO_ACTIONS_APP_PRIVATE_KEY`.

Yearly rotation:

1. In the app settings, generate a new private key.
2. Store it in the password manager and set it in the environment `release` of
   this repository (Settings → Environments → release → Secrets).
3. Run a workflow that uses the app, for example re-run the last publish, and
   check that it works.
4. Delete the old key in the app settings.

Possibly leaked key: delete the key in the app settings **first**, then follow
the steps above, and check the audit log and the recent workflow runs for
unexpected activity.

## App Permissions

1. Add the permission in the app settings only when a step needs it, and accept
   the change in the installation.
2. Request it only in that step (`permission-<name>` of
   `actions/create-github-app-token`).
3. Document it in [ARCHITECTURE.md](ARCHITECTURE.md#github-app) in the same pull
   request.
4. Remove permissions that are no longer used.

## Node.js Runtime

When the GitHub Actions runner offers a new Node.js runtime:

1. Change `using:` in every `action.yml`.
2. Update `.nvmrc`, `engines` in all `package.json` files, and `@types/node` to
   the same major version.
3. Run `pnpm run preflight`.
4. Add a major changeset for every action.

## New Major Version

1. Describe the breaking changes and the migration in the changeset.
2. Update the supported versions in [SECURITY.md](SECURITY.md) and
   [SUPPORT.md](SUPPORT.md).
3. List the new version in the Marketplace.
