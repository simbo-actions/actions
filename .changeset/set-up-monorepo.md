---
'changelog': minor
---

Set up the monorepo for actions that are published to their own repositories.

- pnpm workspaces with Turbo, strict TypeScript, ESLint, Prettier, CSpell, and
  commitlint from the shared `@simbo` configurations.
- Changesets version every action independently.
- A Git hook scans staged changes for secrets with Gitleaks.
