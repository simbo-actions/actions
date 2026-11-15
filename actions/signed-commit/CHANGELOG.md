# signed-commit

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

- 8510056: Create signed commits and tags via the GitHub API, shown as verified.

  - Detects changes in the working tree or the index, filtered by file patterns.
  - Refuses to overwrite a branch that moved, and creates missing branches.
  - Creates every tag with its own API call, also without changes.
  - Syncs the local checkout, and reports in a job summary.
