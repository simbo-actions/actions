---
'changelog': patch
---

Allow the license `PSF-2.0` for development tools.

- `argparse` 3, which `js-yaml` 5 pulls in for ESLint and the actions list, uses
  it; `argparse` 2 used `Python-2.0`.
- The scanner calls in `check:vulnerabilities`, `checks` and `security` and the
  table in `STANDARDS.md` list it.
