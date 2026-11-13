# Simbo's Actions

A family of GitHub Actions, each in its own repository, built and released
automatically, signed and secure.

Built for production use in security-conscious organizations: least privilege, a
pinned and verified supply chain, tested behavior, complete documentation, and
reproducible releases with build provenance.

## Actions

<!-- PACKAGES -->

- [**apply-repository-settings**](https://github.com/simbo-actions/apply-repository-settings):
  A GitHub Action to apply repository settings, security features, Actions
  permissions, and rulesets from a configuration file, writing only what
  differs.
- [**floating-version-tags**](https://github.com/simbo-actions/floating-version-tags):
  A GitHub Action to move floating version tags like v1 forward to a release,
  safely: forward only, never to prereleases.
- [**github-app-bot-user**](https://github.com/simbo-actions/github-app-bot-user):
  A GitHub Action to get the bot user of a GitHub App: user ID, login, name, and
  email for Git.
- [**signed-commit**](https://github.com/simbo-actions/signed-commit): A GitHub
  Action to create signed commits and tags via the GitHub API, shown as
  verified.
- [**staged-release**](https://github.com/simbo-actions/staged-release): A
  GitHub Action to create a complete GitHub release: draft, assets, then
  publish. Works with immutable releases.

<!-- /PACKAGES -->

## Usage

Pin an action by the commit SHA of a release tag, with the version as a comment:

```yaml
- uses: simbo-actions/<action>@<SHA> # vX.Y.Z
```

For convenience, `@vX` follows the latest stable release of a major version. It
moves only forward, only by the release process, but it can change; a SHA pin
cannot.

All actions are developed in the monorepo
[`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
published to their repositories automatically. Issues, questions, and
contributions go there; see its
[standards](https://github.com/simbo-actions/actions/blob/main/STANDARDS.md) and
[security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).
