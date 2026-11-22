---
'changelog': patch
---

Release and publish only the commit that passed the checks, not the current
`main`.

- The workflow `checks` passes the checked SHA to the release and dispatches it
  only in the repository of `simbo-actions`.
- The workflow `release` checks the SHA and builds that commit. If `main` has
  moved on, the release commit fails, and the release of the later commit takes
  over.
- The workflow `release` dispatches `publish-organization` with the SHA of the
  release commit, instead of a publish on every push to `main`.
- The workflow `publish-organization` checks the SHA, publishes that commit, and
  skips manual runs.
