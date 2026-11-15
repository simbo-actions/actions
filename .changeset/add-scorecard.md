---
'changelog': patch
---

Rate the monorepo with OpenSSF Scorecard.

- The workflow `scorecard` runs weekly, on every push to `main`, and when a
  ruleset changes.
- It uploads the results to code scanning and publishes the score on
  scorecard.dev.
- The Actions policy of the organization allows `ossf/scorecard-action`.
