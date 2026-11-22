---
'changelog': patch
---

Leave local worktrees of Claude Code out of the formatting check.

- Prettier ignores `.claude/worktrees/`, so `pnpm run preflight` checks only the
  files of the repository, not the copies in local worktrees.
