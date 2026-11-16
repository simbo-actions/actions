# 🔄 Simbo's Actions — Roadmap

Plans for the next year, until the end of 2027.  
The roadmap is a direction, not a promise; it changes in pull requests like any
other document (see [GOVERNANCE.md](GOVERNANCE.md)).

## Next

- **Blocking code scanning:** findings of CodeQL block pull requests, not only
  the next release.
- **Software bill of materials:** every release ships an SBOM of the bundled
  dependencies, attested like the release archive.
- **Vulnerability exploitability:** accepted findings of osv-scanner are also
  published as VEX statements, with the reasons already in `osv-scanner.toml`.
- **Reproducible builds:** verify that a build from the same commit produces
  identical bundles, and check it in CI.

## Later

- **Shared GitHub API client:** the identical copies of the Octokit client in
  the actions move to a published package.
- **Developer Certificate of Origin:** every commit carries a sign-off, checked
  in CI.
- **OpenSSF Best Practices "silver":** the remaining criteria, among them a plan
  for access continuity if the maintainer is unavailable.
- **New actions** as needs arise, each meeting [STANDARDS.md](STANDARDS.md) from
  its first release.
