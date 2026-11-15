# github-app-bot-user

## 1.0.3

### Patch Changes

- f7dcbdc: Use the same description in `action.yml`, `package.json`, and the
  README.

  - `floating-version-tags` and `staged-release` quote the description in
    `action.yml` to keep the colon of the other places.
  - `github-app-bot-user` uses the wording of `action.yml` and the README in
    `package.json`, which is also the description of its repository.

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

- aded0d9: Get the bot user of a GitHub App and its Git identity.

  - User ID, login, name, noreply email, and the author string for Git.
  - A job summary with the bot user.
