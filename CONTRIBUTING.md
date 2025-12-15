# 🔄 Simbo's Actions — Development and Contribution Guidelines

Thank you for your interest in contributing to Simbo's Actions!

This document should help you get started with developing and guide you through
the contribution process until the release and publication of your changes.

## Development

### Requirements

- a linux-based operating system
- node.js (v24) via [nvm](https://github.com/nvm-sh/nvm)
- [pnpm](https://pnpm.io/) (v10)

### Setup

```bash
git clone git@github.com:simbo-actions/actions.git
cd actions
nvm install
pnpm install
pnpm exec turbo run build
```

### Scripts

See the `package.json` files of individual actions for available scripts.

Depending on the workspace's features, the following common scripts exists:

- `build` - builds the action
- `package` - run post-build packaging steps
- `test` - runs tests for the action
  - `test:watch` - runs tests in watch mode
  - `test:ui` - runs tests in UI mode
- `check` - run all other checks (linting, type checking, etc.)
  - `check:*` - run specific checks (e.g., `lint`, `types`, etc.)
- `clean` - cleans all files not tracked by git
  - `clean:*` - cleans specific files (e.g., `dist`, `node_modules`, etc.)
