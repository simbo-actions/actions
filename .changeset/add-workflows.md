---
'changelog': minor
---

Add the workflows that check, test, release, and publish the actions.

- `checks` builds, tests, lints, and scans every change for vulnerabilities,
  licenses, and secrets, and requires a changeset on pull requests.
- `smoke-tests` runs the built actions against the GitHub API and writes in the
  repository `simbo-actions/sandbox` as the app `simbo-actions-sandbox`.
- `release` integrates the changesets with a signed commit and tags every
  released action; `publish` and `publish-organization` publish them with build
  provenance to their own repositories, whose settings are kept as code.
- Jobs with credentials run no npm code, and builds that are released use no
  cache.
- Dependabot keeps actions and npm dependencies up to date.
