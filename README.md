# 🔄 Simbo's Actions

The monorepo of [Simbo's Actions](https://github.com/simbo-actions): every
action is developed, tested, and released here, and published to its own
repository by the release process.

This is the place for issues, questions, and contributions, and for the
documentation of how the actions are built, released, and secured.

Every action follows the same [standards](STANDARDS.md):

- strict TypeScript, at least 90 % test coverage, and integration tests on
  GitHub;
- tokens limited to the repository and the permissions of each step;
- dependencies pinned and updated after a cooldown;
- releases built in CI, with verified commits, checksums, and build provenance.

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

The details are in the [architecture](ARCHITECTURE.md).

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
