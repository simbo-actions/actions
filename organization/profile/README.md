# Simbo's Actions

A collection of GitHub Actions, each in its own repository and published from
one monorepo by an automated release process.

Every action follows the same standards and the same release process:

- **Built from source in CI.** Every release is built in the monorepo, committed
  as a verified commit, and published with checksums and build provenance.
- **Tags that only move forward.** A version tag `vX.Y.Z` never changes; the
  major tag `vX` is moved only by the release process.
- **Least privilege.** Every token is limited to the repository and the
  permissions that a step needs, and every action documents what it requires.
- **Tested and checked.** Strict TypeScript, at least 90 % test coverage,
  integration tests on GitHub, and scans for secrets and vulnerabilities.

How this fits together: [How It Works](#how-it-works).

## Actions

<!-- PACKAGES -->

There are currently _**6**_ GitHub Actions in this organization.

- ### **Apply Repository Settings**

  > A GitHub Action to apply repository settings, rulesets, labels,
  > environments, and more from YAML, writing only what differs.

  ⚙️ **`simbo-actions/apply-repository-settings@<SHA> # v1.0.3`**

  Latest Version: `1.0.3`

  [Repository](https://github.com/simbo-actions/apply-repository-settings)  • 
  [README.md](https://github.com/simbo-actions/apply-repository-settings/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/apply-repository-settings/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/apply-repository-settings/releases)

- ### **Floating Version Tags**

  > A GitHub Action to move floating version tags like v1 forward to a release,
  > safely: forward only, never to prereleases.

  ⚙️ **`simbo-actions/floating-version-tags@<SHA> # v1.0.2`**

  Latest Version: `1.0.2`

  [Repository](https://github.com/simbo-actions/floating-version-tags)  • 
  [README.md](https://github.com/simbo-actions/floating-version-tags/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/floating-version-tags/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/floating-version-tags/releases)

- ### **GitHub App Bot User**

  > A GitHub Action to get the bot user of a GitHub App, with user ID, login,
  > name, and email for Git.

  ⚙️ **`simbo-actions/github-app-bot-user@<SHA> # v1.0.2`**

  Latest Version: `1.0.2`

  [Repository](https://github.com/simbo-actions/github-app-bot-user)  • 
  [README.md](https://github.com/simbo-actions/github-app-bot-user/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/github-app-bot-user/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/github-app-bot-user/releases)

- ### **Gitleaks Scan**

  > A GitHub Action to scan the Git history for secrets with Gitleaks, from a
  > pinned and checksum-verified binary, in one step.

  ⚙️ **`simbo-actions/gitleaks-scan@<SHA> # v1.0.2`**

  Latest Version: `1.0.2`

  [Repository](https://github.com/simbo-actions/gitleaks-scan)  • 
  [README.md](https://github.com/simbo-actions/gitleaks-scan/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/gitleaks-scan/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/gitleaks-scan/releases)

- ### **Signed Commit**

  > A GitHub Action to create signed commits and tags via the GitHub API, shown
  > as verified.

  ⚙️ **`simbo-actions/signed-commit@<SHA> # v1.0.2`**

  Latest Version: `1.0.2`

  [Repository](https://github.com/simbo-actions/signed-commit)  • 
  [README.md](https://github.com/simbo-actions/signed-commit/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/signed-commit/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/signed-commit/releases)

- ### **Staged Release**

  > A GitHub Action to create a complete GitHub release: draft, assets, then
  > publish. Works with immutable releases.

  ⚙️ **`simbo-actions/staged-release@<SHA> # v1.0.2`**

  Latest Version: `1.0.2`

  [Repository](https://github.com/simbo-actions/staged-release)  • 
  [README.md](https://github.com/simbo-actions/staged-release/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/staged-release/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/staged-release/releases)

<!-- /PACKAGES -->

## Usage

Pin an action by the commit SHA of a release tag, with the version as a comment:

```yaml
- uses: simbo-actions/<action>@<SHA> # vX.Y.Z
```

For convenience, `@vX` follows the latest stable release of a major version.  
It moves only forward, only by the release process, but it can change; a SHA pin
cannot.

## How It Works

GitHub runs an action from the repository and the ref that a workflow names.  
A JavaScript action ships its build in that repository, the Marketplace lists
one action per repository, and most workflows reference an action by a major tag
like `v1` that has to follow every release.

With many actions, this usually means one of two compromises:

- separate repositories, each with its own builds, tags, settings, and
  dependency updates;
- or one repository with all builds and prefixed tags, and no Marketplace
  listings.

Simbo's Actions keeps source and distribution apart:

- All actions are developed, tested, and released in the monorepo
  [`simbo-actions/actions`](https://github.com/simbo-actions/actions), under one
  set of standards and tooling.
- A release builds each action in CI and publishes it to its own repository: a
  verified commit, the version tag, a release with checksums and build
  provenance, and the major tag moved forward.
- The release process creates and configures these repositories; they accept no
  other changes.

The details are in the
[architecture](https://github.com/simbo-actions/actions/blob/main/ARCHITECTURE.md).

Issues, questions, and contributions go to the monorepo; see its
[standards](https://github.com/simbo-actions/actions/blob/main/STANDARDS.md) and
[security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).
