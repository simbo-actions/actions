---
'changelog': patch
---

Keep the original error when `create-dependency-changeset` cannot remove its
worktree.

- A failed `git worktree remove` only warns; the script then deletes the folder
  and prunes the worktree.
- Before, the failed removal replaced the original error, for example of
  `git worktree add`, and left the folder behind.
