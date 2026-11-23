---
'changelog': patch
---

Set up pnpm, Node.js, and the dependencies with `pnpm/setup` in the workflows.

- One step replaces `pnpm/action-setup`, `actions/setup-node`, and the install
  step; it reads the Node.js version from `.nvmrc` and installs with
  `require-lockfile: true`, like `--frozen-lockfile` before.
- The pnpm store is cached in the same jobs as before: Checks, Security, and
  Smoke Tests; Release, Publish, and the changeset for dependency updates still
  run without it.
- The check for privileged jobs also rejects `pnpm/setup`.
- The Actions policy of the organization allows `pnpm/setup` instead of
  `pnpm/action-setup`.
