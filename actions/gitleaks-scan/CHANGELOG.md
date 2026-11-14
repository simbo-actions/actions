# gitleaks-scan

## 1.0.0

### Major Changes

- 05b45d1: Scan for secrets with Gitleaks 8.30.1 from a pinned and
  checksum-verified binary.

  - By default the commits of a pull request or push; or the whole history, the
    files of the working tree, or commits selected with `log-opts`.
  - A baseline of accepted findings, and reporting without failing.
  - Annotations, a SARIF report, and a job summary; secrets are redacted.
