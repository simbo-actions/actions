# gitleaks-scan

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

- 05b45d1: Scan for secrets with Gitleaks 8.30.1 from a pinned and
  checksum-verified binary.

  - By default the commits of a pull request or push; or the whole history, the
    files of the working tree, or commits selected with `log-opts`.
  - A baseline of accepted findings, and reporting without failing.
  - Annotations, a SARIF report, and a job summary; secrets are redacted.
