## About Simbo's Actions

This action is part of [Simbo's Actions](https://github.com/simbo-actions), a
collection of GitHub Actions that are developed in one monorepo and published to
their own repositories by an automated release process.

- **Built from source in CI.** Every release is built in
  [`simbo-actions/actions`](https://github.com/simbo-actions/actions), committed
  to this repository as a verified commit, and published with checksums and
  build provenance. Nothing in this repository is edited by hand.
- **Tags that only move forward.** A version tag `vX.Y.Z` never changes. The
  major tag `vX` is moved only by the release process, to the latest stable
  release.
- **One standard for every action.** Strict TypeScript, tests with at least 90 %
  coverage, least-privilege tokens, pinned dependencies that are updated after a
  cooldown, and scans for secrets and vulnerabilities; see the
  [standards](https://github.com/simbo-actions/actions/blob/main/STANDARDS.md).
- **Tested on GitHub.** Before each release, every action runs in integration
  tests on GitHub; actions that write run against a sandbox repository.

Issues, questions, and contributions go to
[`simbo-actions/actions`](https://github.com/simbo-actions/actions).
