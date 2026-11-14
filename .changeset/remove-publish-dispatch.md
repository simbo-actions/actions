---
'changelog': patch
---

Remove the manual trigger of the publish workflow.

- A failed publish is repeated by re-running its tag push run.
- Resolves the code scanning alerts for cache poisoning: a manual run checked
  out a release tag in the cache scope of `main`.
