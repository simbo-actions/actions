# 🔄 Simbo's Actions

> The source of all actions: develops, tests, and publishes them to their own
> repositories with signed commits, tags, and releases.

Every action in this repository follows the same [standards](STANDARDS.md):

- least privilege
- a pinned and verified supply chain
- tested behavior
- complete documentation
- reproducible releases with build provenance

## Actions

The [organization profile](https://github.com/simbo-actions) lists all actions,
each with a link to its repository and README.

## Usage

Every action is published to its own repository in the organization
[`simbo-actions`](https://github.com/simbo-actions).  
Pin an action by the commit SHA of a release tag, with the version as a comment:

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

Dependabot keeps SHA pins up to date.

For convenience, every action also has a floating tag for its major version,
like `@v1`.  
It moves only forward, only by the release process, but it can change; a SHA pin
cannot.

How to verify a release is described in
[SECURITY.md](SECURITY.md#verifying-a-release).

## Documentation

| Document                           | For                                                   |
| ---------------------------------- | ----------------------------------------------------- |
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
