# Simbo's Actions

A family of GitHub Actions, each in its own repository, built and released
automatically, signed and secure.

Built for production use in security-conscious organizations:

- least privilege
- a pinned and verified supply chain
- tested behavior
- complete documentation
- reproducible releases with build provenance

## Actions

<!-- PACKAGES -->

There are currently _**6**_ GitHub Actions in this organization.

- ### **Apply Repository Settings**

  > A GitHub Action to apply repository settings, rulesets, labels,
  > environments, and more from a YAML file, writing only what differs.

  ⚙️ **`simbo-actions/apply-repository-settings@<SHA> # v1.0.0`**

  Latest Version: `1.0.0`

  [Repository](https://github.com/simbo-actions/apply-repository-settings)  • 
  [README.md](https://github.com/simbo-actions/apply-repository-settings/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/apply-repository-settings/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/apply-repository-settings/releases)

- ### **Floating Version Tags**

  > A GitHub Action to move floating version tags like v1 forward to a release,
  > safely: forward only, never to prereleases.

  ⚙️ **`simbo-actions/floating-version-tags@<SHA> # v1.0.1`**

  Latest Version: `1.0.1`

  [Repository](https://github.com/simbo-actions/floating-version-tags)  • 
  [README.md](https://github.com/simbo-actions/floating-version-tags/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/floating-version-tags/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/floating-version-tags/releases)

- ### **GitHub App Bot User**

  > A GitHub Action to get the bot user of a GitHub App: user ID, login, name,
  > and email for Git.

  ⚙️ **`simbo-actions/github-app-bot-user@<SHA> # v1.0.0`**

  Latest Version: `1.0.0`

  [Repository](https://github.com/simbo-actions/github-app-bot-user)  • 
  [README.md](https://github.com/simbo-actions/github-app-bot-user/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/github-app-bot-user/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/github-app-bot-user/releases)

- ### **Gitleaks Scan**

  > A GitHub Action to scan the Git history for secrets with Gitleaks, from a
  > pinned and checksum-verified binary, in one step.

  ⚙️ **`simbo-actions/gitleaks-scan@<SHA> # v1.0.0`**

  Latest Version: `1.0.0`

  [Repository](https://github.com/simbo-actions/gitleaks-scan)  • 
  [README.md](https://github.com/simbo-actions/gitleaks-scan/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/gitleaks-scan/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/gitleaks-scan/releases)

- ### **Signed Commit**

  > A GitHub Action to create signed commits and tags via the GitHub API, shown
  > as verified.

  ⚙️ **`simbo-actions/signed-commit@<SHA> # v1.0.0`**

  Latest Version: `1.0.0`

  [Repository](https://github.com/simbo-actions/signed-commit)  • 
  [README.md](https://github.com/simbo-actions/signed-commit/blob/main/README.md)  • 
  [CHANGELOG.md](https://github.com/simbo-actions/signed-commit/blob/main/CHANGELOG.md)  • 
  [Releases](https://github.com/simbo-actions/signed-commit/releases)

- ### **Staged Release**

  > A GitHub Action to create a complete GitHub release: draft, assets, then
  > publish. Works with immutable releases.

  ⚙️ **`simbo-actions/staged-release@<SHA> # v1.0.0`**

  Latest Version: `1.0.0`

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

All actions are developed in the monorepo
[`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
published to their repositories automatically.  
Issues, questions, and contributions go there; see its
[standards](https://github.com/simbo-actions/actions/blob/main/STANDARDS.md) and
[security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).
