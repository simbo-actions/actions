# gitleaks-scan

## 1.0.0

### Major Changes

- 473d7e6: Initial release: scan for secrets with Gitleaks 8.30.1, from a pinned
  and checksum-verified binary, with annotations and a job summary. Scans the
  commits of a pull request or push by default, or the whole history, the files
  of the working tree, or commits selected with `log-opts`; supports a baseline
  and reporting without failing.
