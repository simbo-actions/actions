# 🔄 Simbo's Actions

> The source of all actions: develops, tests, and publishes them to their own
> repositories with signed commits, tags, and releases.

Every action in this repository follows the same [standards](STANDARDS.md):
least privilege, a pinned and verified supply chain, tested behavior, complete
documentation, and reproducible releases with build provenance.

## Actions

<!-- PACKAGES -->

There are currently _**6**_ GitHub Actions managed in this repository.

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
- [**gitleaks-scan**](https://github.com/simbo-actions/gitleaks-scan): A GitHub
  Action to scan the Git history for secrets with Gitleaks, from a pinned and
  checksum-verified binary, in one step.
- [**signed-commit**](https://github.com/simbo-actions/signed-commit): A GitHub
  Action to create signed commits and tags via the GitHub API, shown as
  verified.
- [**staged-release**](https://github.com/simbo-actions/staged-release): A
  GitHub Action to create a complete GitHub release: draft, assets, then
  publish. Works with immutable releases.

<!-- /PACKAGES -->

[ACTIONS.md](ACTIONS.md) lists all actions with versions and links.

## Usage

Every action is published to its own repository in the organization
[`simbo-actions`](https://github.com/simbo-actions). Pin an action by the commit
SHA of a release tag, with the version as a comment:

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - name: 💾 Commit Changes
        uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
        with:
          token: ${{ steps.app-token.outputs.token }}
          message: 'chore: update generated files'
```

Dependabot keeps SHA pins up to date. For convenience, every action also has a
floating tag for its major version, like `@v1`. It moves only forward, only by
the release process, but it can change; a SHA pin cannot. How to verify a
release is described in [SECURITY.md](SECURITY.md#verifying-a-release).

## Documentation

| Document                           | For                                                   |
| ---------------------------------- | ----------------------------------------------------- |
| [ACTIONS.md](ACTIONS.md)           | All actions, with versions and links                  |
| [STANDARDS.md](STANDARDS.md)       | The quality and security requirements of every action |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How actions are released, published, and managed      |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to report issues and contribute                   |
| [DEVELOPMENT.md](DEVELOPMENT.md)   | Setup, scripts, tests, and adding an action           |
| [SECURITY.md](SECURITY.md)         | Reporting vulnerabilities, supported versions         |
| [SUPPORT.md](SUPPORT.md)           | Getting help, support policy                          |
| [MAINTAINING.md](MAINTAINING.md)   | Runbooks for maintainers                              |
| [CHANGELOG.md](CHANGELOG.md)       | Where to find the changelogs                          |

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)
