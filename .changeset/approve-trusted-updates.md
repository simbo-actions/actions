---
'changelog': patch
---

Approve low-risk Dependabot updates before merging them automatically.

- The workflow `automerge` approves minor and patch updates of trusted
  publishers, since the ruleset "Main Branch" requires an approval.
- All other Dependabot pull requests still need the approval of a maintainer.
