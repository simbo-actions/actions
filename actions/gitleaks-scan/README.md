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
- [What Is Scanned](#what-is-scanned)
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
3. Determines what to scan from `scope` and the event, see
   [What Is Scanned](#what-is-scanned): by default the commits of a pull request
   or push, otherwise the whole history.
4. Scans with `gitleaks git --redact`, or `gitleaks dir --redact` for the files
   of the working tree.
5. Reports every finding as annotation at its file and line, so that it shows in
   the pull request diff, and lists the findings in the job summary, together
   with what was scanned.  
   Secrets are redacted; author names and emails are left out.
6. Fails if anything was found, unless `fail-on-findings` is `false`.  
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

### Weekly Scan of the Whole History

Pull requests and pushes scan only their commits.  
A scheduled scan of the whole history also finds secrets that a new rule of a
newer Gitleaks version detects in old commits:

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'

jobs:
  secrets:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      # … checkout with fetch-depth: 0 …

      - name: 🔐 Scan for Secrets
        uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
        with:
          scope: history
```

### Files of the Working Tree

Scans the checked-out files, including generated and untracked ones, without the
history:

```yaml
- name: 🔐 Scan Files for Secrets
  uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
  with:
    scope: files
```

### Report Without Failing

For example while introducing the scan in a repository with known findings:

```yaml
- name: 🔐 Scan for Secrets
  id: gitleaks
  uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
  with:
    fail-on-findings: false

- name: 📣 Report
  if: ${{ steps.gitleaks.outputs.findings != '0' }}
  env:
    FINDINGS: ${{ steps.gitleaks.outputs.findings }}
    SCANNED: ${{ steps.gitleaks.outputs.scanned }}
  run: echo "::notice::${FINDINGS} potential secrets in ${SCANNED}."
```

### Baseline of Accepted Findings

A baseline is a Gitleaks report whose findings are ignored; new findings still
fail.  
Create it locally with `gitleaks git --report-path gitleaks-baseline.json` and
commit it:

```yaml
- name: 🔐 Scan for Secrets
  uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
  with:
    scope: history
    baseline-path: gitleaks-baseline.json
```

### Selected Commits

`log-opts` passes options to `git log` and overrides `scope`:

```yaml
- name: 🔐 Scan Recent Commits
  uses: simbo-actions/gitleaks-scan@<SHA> # vX.Y.Z
  with:
    log-opts: --since=2024-01-01 --all
```

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
| `scope`             | `auto`, `changes`, `history`, or `files`; see [What Is Scanned](#what-is-scanned)                          | false    | `auto`  |
| `log-opts`          | Options for `git log` that select the commits to scan; override `scope`, not allowed with `files`          | false    |         |
| `config`            | A Gitleaks configuration file, relative to `working-directory`; see [below](#findings-and-false-positives) | false    |         |
| `baseline-path`     | A Gitleaks report, relative to `working-directory`, whose findings are ignored                             | false    |         |
| `fail-on-findings`  | Whether findings fail the action; with `false`, they are reported as warnings                              | false    | `true`  |

A `config` or `baseline-path` that does not exist fails the action before the
scan.

The Gitleaks version is intentionally not an input: only the pinned and verified
version runs.  
A new Gitleaks version comes with a new release of this action.

## Outputs

| Output       | Description                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------- |
| `findings`   | The number of findings                                                                      |
| `scanned`    | What was scanned, for example `changes abc1234..def5678 (3 commits)`, `history`, or `files` |
| `sarif-file` | The path of the SARIF report, for example to upload it to code scanning                     |

## Token and Permissions

The action needs no token.  
The job needs `contents: read` for the checkout.  
Uploading the SARIF report to code scanning additionally needs
`security-events: write`.

## What Is Scanned

| `scope`   | Pull request, merge group, push           | Other events, for example `schedule` |
| --------- | ----------------------------------------- | ------------------------------------ |
| `auto`    | the commits of the event                  | the whole history                    |
| `changes` | the commits of the event                  | fails                                |
| `history` | the whole history                         | the whole history                    |
| `files`   | the files of the working tree, no history | the files of the working tree        |

The commits of an event are:

- **pull request:** from the base to the head of the pull request
  (`<base>..<head>`), not the merge commit GitHub checks out;
- **merge group:** from the base to the head of the merge group;
- **push:** the pushed commits (`<before>..<after>`);
- **new branch or tag, force push:** there is no previous commit to compare
  with, so the commits that no other remote branch contains are scanned.  
  If there is no other branch, for example on the first push, the whole history
  is scanned, with a warning.

All these commits must be in the checkout: check it out with `fetch-depth: 0`.  
A missing commit fails the action with a clear message; the action does not
fetch, because it has no token.  
`history` also scans a shallow clone, with a warning that only its commits are
covered.

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

- Runs on Linux runners only (x64 and arm64), not on macOS or Windows.
- A scan of the changes only finds secrets in new commits.  
  Schedule a scan of the whole history as well, for example weekly, so that new
  rules also check old commits.
- `history` scans every commit on every run; for very large repositories this
  takes longer.
- This action is not affiliated with the Gitleaks project.

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)

Gitleaks itself is licensed under the MIT license by its authors.
