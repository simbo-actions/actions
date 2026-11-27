# floating-version-tags

## 1.0.5

### Patch Changes

- 268663f: Require Node.js 24.15.0 or a later 24.x release.

  - `engines.node` in `package.json` is `^24.15.0`.
  - The bundled `@simbo` packages need Node.js 24.15.0 or later; the upper bound
    follows the runtime `node24` the action runs with.
  - GitHub-hosted runners provide it.

- 268663f: Update `@simbo/stringify-error` to ^3.0.0.

## 1.0.4

### Patch Changes

- 4e0746b: Update `@simbo/stringify-error` to ^2.0.1.

## 1.0.3

### Patch Changes

- f7dcbdc: Quote the description in `action.yml` to match `package.json` and the
  README.

## 1.0.2

### Patch Changes

- 8d2d45c: Call Simbo's Actions a collection in the section "About Simbo's
  Actions".

## 1.0.1

### Patch Changes

- 1e06401: Replace the note about the monorepo with the section "About Simbo's
  Actions".

  - The README starts with the action itself; the section before "License"
    describes how the action is built, released, and tested, and where issues
    go.
  - Plain Markdown, so it renders the same on the Marketplace and other sites.

## 1.0.0

### Major Changes

- 9770ff3: Move floating version tags like `v1` forward to a release.

  - Only to the highest stable version of their line, never to a prerelease.
  - Lightweight or annotated tags, with a message that names the release.
  - Prefixed tags like `my-package/v1.2.3` and versions without `v`.
  - The tag of the workflow as default, a dry run, and a job summary.
