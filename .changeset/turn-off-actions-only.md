---
'apply-repository-settings': patch
---

Send only `enabled` when Actions is turned off.

- GitHub rejects `allowed_actions` and `sha_pinning_required` with a conflict
  unless Actions is on; with `enabled: false`, the other keys of the group are
  no longer sent or compared.
