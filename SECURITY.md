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

## What to Expect

1. **Acknowledgement within 14 days.** The maintainer confirms the report and
   keeps you informed about the progress.
2. **Assessment.** The maintainer reproduces the issue, rates its severity, and
   determines the affected actions and versions, in the private security
   advisory of the report.
3. **Fix.** The fix is developed in a temporary private fork of the advisory and
   released as a new version of every affected action.
4. **Disclosure.** The security advisory is published with the fix, with a CVE
   if one applies.  
   You are credited, unless you prefer not to be.

This is coordinated disclosure: please do not disclose the issue until the
advisory is published, or until 90 days after your report, whichever comes
first. If a fix needs longer, the maintainer asks for an extension in the
advisory.

## Supported Versions

Security fixes are provided for the **latest major version** of every published
action, as a new release of that version.  
Older major versions are not supported.

## Security Practices

The actions are built and released according to [STANDARDS.md](STANDARDS.md).  
In short:

- Tokens with least privilege, restricted to the repositories a step needs.
- No secrets in pull request workflows.
- All third-party actions pinned by commit SHA.
- Dependency updates with a cooldown and review by risk.
- Verified commits and protected tags.
- Releases only from CI, with checksums and build provenance; immutable
  releases.
- Secret scanning with push protection, code scanning, and Dependabot alerts.
- All dependencies scanned with osv-scanner for vulnerabilities and malicious
  packages, on every pull request, every push to `main`, and weekly.
- Secrets scanned with Gitleaks: the commits of every pull request and push to
  `main`, and the whole Git history weekly.

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
