---
'signed-commit': major
---

Create signed commits and tags via the GitHub API, shown as verified.

- Detects changes in the working tree or the index, filtered by file patterns.
- Refuses to overwrite a branch that moved, and creates missing branches.
- Creates every tag with its own API call, also without changes.
- Syncs the local checkout, and reports in a job summary.
