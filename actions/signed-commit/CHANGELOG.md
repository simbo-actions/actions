# signed-commit

## 2.0.1

### Patch Changes

- 4e0746b: Update dependencies.

  - `@simbo/accessible` to ^2.0.1
  - `@simbo/git-changes` to ^3.0.1
  - `@simbo/stringify-error` to ^2.0.1

## 2.0.0

### Major Changes

- 3f31295: Create annotated tags by default.

  - The input `tag-type` selects `annotated` (default) or `lightweight` tags.
  - An annotated tag has the identity of the token as tagger and the message
    `tag-message`, by default the tag name; `{tag}` in `tag-message` is replaced
    with the tag name, for example `Release {tag}`.
  - An existing tag is accepted only if it points to the same commit and has the
    requested type.
  - With `sync`, annotated tags are fetched from `origin` instead of being
    created locally.
  - The rate limit warning counts two requests per annotated tag.
  - The README explains why tags are not signed: GitHub does not sign tag
    objects created via the API.

  Tags are now annotated tag objects instead of lightweight tags. Set
  `tag-type: lightweight` to keep lightweight tags. A re-run of an earlier run
  fails if its lightweight tags exist while annotated tags are requested; set
  `tag-type: lightweight` for it, or delete the tags first.

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
