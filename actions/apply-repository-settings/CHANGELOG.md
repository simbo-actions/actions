# apply-repository-settings

## 1.0.4

### Patch Changes

- cadcacf: Shorten the description to fit the GitHub Marketplace.

  - The Marketplace allows fewer than 125 characters; the description had 131.
  - "from a YAML file" becomes "from YAML" in `action.yml`, `package.json`, and
    the README.

## 1.0.3

### Patch Changes

- 53a20aa: Send only `enabled` when Actions is turned off.

  - GitHub rejects `allowed_actions` and `sha_pinning_required` with a conflict
    unless Actions is on; with `enabled: false`, the other keys of the group are
    no longer sent or compared.

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

- d645b0b: Apply repository settings from a configuration file, writing only
  what differs.

  - Repository settings, topics, security features, Actions permissions,
    rulesets, labels, environments, autolinks, custom properties, and immutable
    releases.
  - A strict YAML or JSON configuration: unknown keys, wrong types, duplicate
    keys, anchors, and tags fail.
  - `prune` deletes the labels, rulesets, environments, or autolinks that are
    not configured.
  - A dry run, and a job summary of all changes.
