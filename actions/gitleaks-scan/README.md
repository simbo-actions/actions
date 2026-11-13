# Gitleaks Scan _(GitHub Action)_

A GitHub Action to scan the Git history for secrets with
[Gitleaks](https://github.com/gitleaks/gitleaks), from a pinned and
checksum-verified binary, in one step.

> [!NOTE]  
> Developed and maintained in the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
> published here automatically.  
> Issues, questions, and contributions go to the monorepo.

Gitleaks is an open source tool (MIT) that finds secrets such as tokens and
private keys in Git repositories.

This action runs it as a single step:

- no license key, no secret, no Docker image;
- the same in personal and organization repositories, including pull requests
  from forks.

## Contents

- [How It Works](#how-it-works)
- [Usage](#usage)
- [Examples](#examples)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Token and Permissions](#token-and-permissions)
- [Findings and False Positives](#findings-and-false-positives)
- [Security](#security)
- [Limitations](#limitations)

## How It Works

1. Downloads the Gitleaks release that is pinned in this action (currently
   8.30.1) from
   [github.com/gitleaks/gitleaks](https://github.com/gitleaks/gitleaks/releases)
   and verifies its SHA-256 checksum against the checksums built into this
   action.  
   A mismatch fails the action before anything runs.
2. Adds the binary to the runner's tool cache.
3. Scans the whole Git history of the repository with `gitleaks git --redact`.  
   A shallow clone is scanned too, with a warning that only its commits are
   covered.
4. Reports every finding as error annotation at its file and line, so that it
   shows in the pull request diff, and lists the findings in the job summary.  
   Secrets are redacted; author names and emails are left out.
5. Fails if anything was found.  
   The SARIF report stays available as output.

## Usage

Pin the action by commit SHA, with the version as a comment.  
This is recommended: a SHA cannot change.

For convenience, the floating tag `@vX` follows the latest stable release of
major version `X`.  
It moves only forward and only by the release process, but it can change.

```yaml
jobs:
  secrets:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: 🛎️ Checkout
        uses: actions/checkout@<SHA> # vX.Y.Z
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: 🔐 Scan for Secrets
        uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
```

## Examples

### Custom Configuration

```yaml
- name: 🔐 Scan for Secrets
  uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
  with:
    config: .github/gitleaks.toml
```

### Upload to Code Scanning

The findings show as annotations and in the job summary without further steps.  
To track them as code scanning alerts as well, upload the SARIF report:

```yaml
jobs:
  secrets:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      # … checkout with fetch-depth: 0 …

      - name: 🔐 Scan for Secrets
        id: gitleaks
        uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z

      - name: 📤 Upload to Code Scanning
        if: ${{ !cancelled() && steps.gitleaks.outputs.sarif-file }}
        uses: github/codeql-action/upload-sarif@<SHA> # vX.Y.Z
        with:
          sarif_file: ${{ steps.gitleaks.outputs.sarif-file }}
          category: gitleaks
```

## Inputs

| Input               | Description                                                                                                | Required | Default |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `working-directory` | The Git repository to scan                                                                                 | false    | `.`     |
| `config`            | A Gitleaks configuration file, relative to `working-directory`; see [below](#findings-and-false-positives) | false    |         |

The Gitleaks version is intentionally not an input: only the pinned and verified
version runs.  
A new Gitleaks version comes with a new release of this action.

## Outputs

| Output       | Description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `findings`   | The number of findings                                                  |
| `sarif-file` | The path of the SARIF report, for example to upload it to code scanning |

## Token and Permissions

The action needs no token.  
The job needs `contents: read` for the checkout.  
Uploading the SARIF report to code scanning additionally needs
`security-events: write`.

## Findings and False Positives

- **A real secret:** revoke or rotate it first; it is compromised as soon as it
  was pushed.  
  Then remove it from the code.  
  Removing it from the history needs a rewrite and a force push.
- **A false positive:** add its fingerprint to `.gitleaksignore` in the
  repository root.  
  Gitleaks prints the fingerprint for every finding when run locally with
  `gitleaks git -v`.
- **Configuration:** without `config`, Gitleaks uses `.gitleaks.toml` in the
  repository root if it exists, otherwise its default rules.  
  Both `.gitleaks.toml` and `.gitleaksignore` come from the scanned checkout: in
  a pull request, they are part of its changes. Review changes to them like
  code, because they can hide findings.  
  A configuration can extend the default rules and add allowlists, see the
  [Gitleaks documentation](https://github.com/gitleaks/gitleaks#configuration).

## Security

- **Verified binary:** the archive is checked against a SHA-256 checksum built
  into the action, on every run, also when a self-hosted runner has it cached.
- **No secrets needed:** the action works without a token or license key.  
  So it also runs safely in pull requests from forks.
- **Redacted output:** secrets never appear in the log, the annotations, or the
  summary; author names and emails are left out.
- **Network:** the action only downloads the Gitleaks release from GitHub.
- **Verifying a release:** pin the action by the commit SHA of a release tag.  
  Every release has an archive with a `SHA256SUMS` file and build provenance:

  ```sh
  sha256sum --check SHA256SUMS
  gh attestation verify gitleaks-scan-vX.Y.Z.tar.gz --repo simbo-actions/actions
  ```

- **Reporting vulnerabilities:** privately, see the
  [security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).

## Limitations

- Runs on Linux and macOS runners (x64 and arm64), not on Windows.
- Scans the Git history, not uncommitted files.
- The whole history is scanned on every run; for very large repositories this
  takes longer.
- This action is not affiliated with the Gitleaks project.

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)

Gitleaks itself is licensed under the MIT license by its authors.
