# Staged Release _(GitHub Action)_

A GitHub Action to create a complete GitHub release: draft, assets, then
publish.  
Works with immutable releases.

> [!NOTE]  
> Developed and maintained in the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
> published here automatically.  
> Issues, questions, and contributions go to the monorepo.

Most release actions publish a release first and upload the assets afterwards.

With
[immutable releases](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases),
uploads to a published release are rejected, and even without them, consumers
may see a release before its assets exist.  
This action publishes a release only when it is complete.

## Contents

- [How It Works](#how-it-works)
- [Usage](#usage)
- [Examples](#examples)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Token and Permissions](#token-and-permissions)
- [Re-Runs and Failures](#re-runs-and-failures)
- [Security](#security)
- [Limitations](#limitations)

## How It Works

1. Resolves the `assets` patterns to files.  
   A pattern without a match fails the action before anything changes.
2. Checks that the tag exists.  
   The action never creates tags, so a release cannot accidentally point to
   another commit.
3. Removes leftover **draft** releases of the tag from a previous failed run.  
   If the tag is already **released**, the action fails.
4. Creates the release as draft, with title and release notes.
5. Uploads all assets to the draft.
6. Publishes the release (or leaves it as draft with `publish: false`).

## Usage

Pin the action by commit SHA, with the version as a comment.  
This is recommended: a SHA cannot change.

For convenience, the floating tag `@vX` follows the latest stable release of
major version `X`.  
It moves only forward and only by the release process, but it can change.

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: 🛎️ Checkout
        uses: actions/checkout@<SHA> # vX.Y.Z
        with:
          persist-credentials: false

      - name: 👷 Build
        run: make dist

      - name: 🎁 Create GitHub Release
        uses: simbo-actions/staged-release@<SHA> # vX.Y.Z
        with:
          token: ${{ github.token }}
          tag: ${{ github.ref_name }}
          body-file: dist/RELEASE_NOTES.md
          assets: |
            dist/*.tar.gz
            dist/SHA256SUMS
```

## Examples

### Release Notes from a Changelog Section

```yaml
- name: 📝 Extract Release Notes
  env:
    VERSION: ${{ steps.version.outputs.version }}
  run: |
    set -euo pipefail
    awk -v version="$VERSION" '
      $0 ~ "^## " version "$" { found = 1; next }
      found && /^## / { exit }
      found { print }
    ' CHANGELOG.md > "${RUNNER_TEMP}/notes.md"

- name: 🎁 Create GitHub Release
  uses: simbo-actions/staged-release@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    tag: v${{ steps.version.outputs.version }}
    body-file: ${{ runner.temp }}/notes.md
    assets: dist/*
```

### Release in Another Repository

```yaml
- name: 🎁 Create GitHub Release
  uses: simbo-actions/staged-release@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: my-org/my-action
    tag: v1.2.0
    name: my-action v1.2.0
    body: See the changelog for details.
```

### Prepare a Draft for Manual Review

```yaml
- name: 🎁 Prepare Draft Release
  uses: simbo-actions/staged-release@<SHA> # vX.Y.Z
  with:
    token: ${{ github.token }}
    tag: v2.0.0
    assets: dist/*
    publish: false
```

## Inputs

| Input               | Description                                                                         | Required | Default                    |
| ------------------- | ----------------------------------------------------------------------------------- | -------- | -------------------------- |
| `token`             | The token to authenticate with, see [Token and Permissions](#token-and-permissions) | true     |                            |
| `repository`        | The repository to create the release in (`owner/repo`)                              | false    | `${{ github.repository }}` |
| `tag`               | The existing tag to release                                                         | true     |                            |
| `name`              | The release title                                                                   | false    | the tag                    |
| `body`              | The release notes                                                                   | false    |                            |
| `body-file`         | A file with the release notes, relative to `working-directory`                      | false    |                            |
| `assets`            | Files to upload, one path or glob pattern per line, relative to `working-directory` | false    |                            |
| `working-directory` | The directory `assets` and `body-file` are resolved against                         | false    | `.`                        |
| `make-latest`       | `true`, `false`, or `legacy` (latest by date and version)                           | false    | `true`                     |
| `prerelease`        | Whether the release is a prerelease                                                 | false    | `false`                    |
| `publish`           | Whether to publish the release; with `false`, it stays a draft                      | false    | `true`                     |

- Use either `body` or `body-file`.
- Asset names are the file names; two assets with the same name fail the action.
- Glob patterns support `*`, `**`, and `?`.

## Outputs

| Output       | Description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `release-id` | The ID of the release                                                   |
| `url`        | The URL of the release page                                             |
| `assets`     | The uploaded assets as JSON: `[{"name": ..., "size": ..., "url": ...}]` |

## Token and Permissions

- **`GITHUB_TOKEN`:** works with `permissions: contents: write` for releases in
  the same repository.
- **GitHub App installation token:** for releases in other repositories, with
  `contents: write` on that repository.

The tag must exist before the action runs, for example created by a push or by
[`signed-commit`](https://github.com/simbo-actions/signed-commit) with `tags`.

## Re-Runs and Failures

- If the action fails after creating the draft, for example while uploading an
  asset, the draft stays.  
  A re-run removes it and starts again.
- If the tag is already released, the action fails instead of changing the
  release.  
  With immutable releases, a published release cannot be changed anyway; a
  correction is a new version.
- API requests that hit a rate limit wait as long as GitHub asks for and are
  retried up to 4 times (`@octokit/plugin-throttling`).

## Security

- **No tag creation:** the action fails for a missing tag, so a release never
  points to an unexpected commit.
- **Complete before public:** the release is published only after all assets are
  uploaded.
- **Token:** used only for the GitHub API; restrict it to the target repository
  and `contents: write`.
- **Verifying a release:** pin the action by the commit SHA of a release tag.  
  Every release has an archive with a `SHA256SUMS` file and build provenance:

  ```sh
  sha256sum --check SHA256SUMS
  gh attestation verify staged-release-vX.Y.Z.tar.gz --repo simbo-actions/actions
  ```

- **Reporting vulnerabilities:** privately, see the
  [security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).

## Limitations

- The action does not create or move tags.
- Assets are uploaded with the content type `application/octet-stream`.
- Existing published releases are never changed.

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)
