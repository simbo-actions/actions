---
'floating-version-tags': patch
'github-app-bot-user': patch
'staged-release': patch
---

Use the same description in `action.yml`, `package.json`, and the README.

- `floating-version-tags` and `staged-release` quote the description in
  `action.yml` to keep the colon of the other places.
- `github-app-bot-user` uses the wording of `action.yml` and the README in
  `package.json`, which is also the description of its repository.
