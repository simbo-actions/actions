# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities **privately** via
[GitHub private vulnerability reporting](https://github.com/simbo-actions/actions/security/advisories/new),
not in public issues, discussions, or pull requests.

Include what you can:

- the affected action and version,
- a description of the vulnerability and its impact,
- steps to reproduce, or a proof of concept,
- a suggested fix, if you have one.

What to expect:

- The maintainer aims to acknowledge a report within 7 days and keeps you
  informed about the progress.
- Fixes are released as new versions; a security advisory is published with the
  fix. You are credited, unless you prefer not to be.
- Please give a reasonable time to fix the issue before disclosing it.

## Supported Versions

Security fixes are provided for the **latest major version** of each published
action.

| Action                                                                                    | Supported  |
| ----------------------------------------------------------------------------------------- | ---------- |
| [`signed-commit`](https://github.com/simbo-actions/signed-commit)                         | latest 1.x |
| [`github-app-bot-user`](https://github.com/simbo-actions/github-app-bot-user)             | latest 1.x |
| [`apply-repository-settings`](https://github.com/simbo-actions/apply-repository-settings) | latest 1.x |
| [`staged-release`](https://github.com/simbo-actions/staged-release)                       | latest 1.x |

## Security Practices

The actions are built and released according to [STANDARDS.md](STANDARDS.md). In
short:

- Tokens with least privilege, restricted to the repositories a step needs.
- No secrets in pull request workflows.
- All third-party actions pinned by commit SHA; dependency updates with a
  cooldown and review by risk.
- Verified commits and protected tags; releases only from CI, with checksums and
  build provenance; immutable releases.
- Secret scanning with push protection, code scanning, and Dependabot alerts.
- All dependencies scanned with osv-scanner for vulnerabilities and malicious
  packages, on every pull request and weekly.

## Verifying a Release

Pin actions by the commit SHA of a release tag:

```yaml
uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
```

Verify a release asset and its build provenance:

```sh
sha256sum --check SHA256SUMS
gh attestation verify signed-commit-vX.Y.Z.tar.gz --repo simbo-actions/actions
```
