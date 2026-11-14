---
'changelog': patch
---

Skip manual runs of the release workflow.

- Only the dispatch by the checks on `main` starts a release, so a release
  cannot bypass failed checks.
- Re-runs of a failed release still work, because they keep the actor of the
  original run.
