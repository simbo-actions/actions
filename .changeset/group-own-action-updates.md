---
'changelog': patch
---

Update all own actions in one Dependabot pull request.

- The group `simbo-actions` no longer splits by dependency; a release that
  updates several actions brings one pull request instead of one per action.
- The own actions are pinned only in the workflows, in one directory, so the
  group needs no split by directory.
