# apply-repository-settings

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
