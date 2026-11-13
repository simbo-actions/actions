# 🔄 Simbo's Actions — Contributing

Thank you for your interest in contributing!  
Bug reports, ideas, documentation improvements, and code are all welcome.

This document explains how to get involved and what to expect.

## Ways to Contribute

- **Report a bug:** open an
  [issue](https://github.com/simbo-actions/actions/issues/new/choose) with the
  template "Bug report".  
  A minimal workflow that shows the problem helps most.
- **Suggest a feature:** open an issue with the template "Feature request" and
  describe the use case.  
  Please discuss larger changes in an issue before writing code.
- **Improve the documentation:** typos, unclear sections, missing examples;
  small fixes can go directly into a pull request.
- **Contribute code:** fix a bug or implement an agreed feature.
- **Report a vulnerability:** privately, see [SECURITY.md](SECURITY.md).

## Before You Start

- Check the existing issues and pull requests.
- Read [STANDARDS.md](STANDARDS.md): every contribution meets these
  requirements, for example tests with at least 90 % coverage and least
  privilege for tokens.
- Read [DEVELOPMENT.md](DEVELOPMENT.md) for setup, scripts, and tests.
- The actions are developed in this repository only.  
  The action repositories (`simbo-actions/<name>`) contain build artifacts and
  do not accept pull requests.

## Pull Requests

1. Fork the repository and create a branch from `main`.
2. Make the change, with tests and documentation.
3. Add a changeset (`pnpm exec changeset`), or an empty one for changes without
   a release (`pnpm exec changeset --empty`).
4. Use [Conventional Commits](https://www.conventionalcommits.org/) messages.
5. Run `pnpm run preflight`.
6. Open the pull request and fill in the template.

Checklist for every pull request:

- [ ] Tests cover the change, including error cases; coverage stays at or above
      90 %.
- [ ] Documentation is updated: the action's README, and
      [ARCHITECTURE.md](ARCHITECTURE.md) if the release process changes.
- [ ] A changeset describes the change for the changelog.
- [ ] New dependencies meet the
      [dependency criteria](STANDARDS.md#dependencies).
- [ ] Workflows follow the [workflow rules](STANDARDS.md#workflows).

## Review and Merge

- Workflows of pull requests from forks need the maintainer's approval before
  they run.  
  Please be patient; this protects the repository.
- The workflow `checks` must pass.  
  It builds, tests, lints, scans, checks licenses, and requires a changeset.
- Pull requests are merged with squash.  
  The release follows automatically.
- This project is maintained in spare time; reviews may take some days.  
  See [SUPPORT.md](SUPPORT.md).

## For Maintainers

Recurring maintenance tasks are described in [MAINTAINING.md](MAINTAINING.md).

## Code of Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT license](LICENSE.md) of this repository.
