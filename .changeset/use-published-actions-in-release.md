---
'changelog': minor
---

Run the published actions, pinned by SHA, in the release.

- Release, publish, publish-organization, and the dependency changeset use the
  released `signed-commit`, `apply-repository-settings`, `staged-release`, and
  `floating-version-tags` instead of building them in the same run.
- `check:actions` fails if a job with the environment `release` runs a local
  action.
- A runbook in MAINTAINING.md describes how to pin back a broken action.
