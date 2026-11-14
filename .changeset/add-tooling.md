---
'changelog': minor
---

Add the monorepo tooling.

- `check:actions` checks license files, README sections, the note about the
  monorepo, identical Octokit clients, matching license lists, and that jobs
  with an environment run no npm code.
- `create-dependency-changeset` adds the changesets for merged Dependabot
  updates of npm dependencies.
- `actions-list` generates the list of actions in the organization profile.
