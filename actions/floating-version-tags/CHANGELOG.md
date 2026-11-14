# floating-version-tags

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
