# 🔄 Simbo's Actions

> GitHub Actions built for production use in security-conscious organizations.

Every action in this repository follows the same [standards](STANDARDS.md):
least privilege, a pinned and verified supply chain, tested behavior, complete
documentation, and reproducible releases with build provenance.

## Actions

<!-- PACKAGES -->

There are currently _**4**_ GitHub Actions managed in this repository.

- [**apply-repository-settings**](https://github.com/simbo-actions/apply-repository-settings):
  A GitHub Action to apply repository settings, security features, Actions
  permissions, and rulesets from a configuration file, writing only what
  differs.
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

There are no moving tags such as `v1` or `latest`. Dependabot keeps SHA pins up
to date. How to verify a release is described in
[SECURITY.md](SECURITY.md#verifying-a-release).

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
