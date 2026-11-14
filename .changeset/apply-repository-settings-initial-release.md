---
'apply-repository-settings': major
---

Apply repository settings from a configuration file, writing only what differs.

- Repository settings, topics, security features, Actions permissions, rulesets,
  labels, environments, autolinks, custom properties, and immutable releases.
- A strict YAML or JSON configuration: unknown keys, wrong types, duplicate
  keys, anchors, and tags fail.
- `prune` deletes the labels, rulesets, environments, or autolinks that are not
  configured.
- A dry run, and a job summary of all changes.
