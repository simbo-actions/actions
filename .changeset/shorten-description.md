---
'apply-repository-settings': patch
---

Shorten the description to fit the GitHub Marketplace.

- The Marketplace allows fewer than 125 characters; the description had 131.
- "from a YAML file" becomes "from YAML" in `action.yml`, `package.json`, and
  the README.
