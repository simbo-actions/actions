# Floating Version Tags _(GitHub Action)_

A GitHub Action to move floating version tags like `v1` forward to a release,
safely: forward only, never to prereleases.

> [!NOTE]  
> Developed and maintained in the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
> published here automatically.  
> Issues, questions, and contributions go to the monorepo.

Consumers of GitHub Actions like to write `uses: owner/action@v1` and get every
fix of the major version automatically.

Maintaining these tags by hand is error-prone: a tag moved to the wrong commit,
to an older version, or to a prerelease reaches every workflow that uses it.  
This action moves floating tags only by clear rules.

## Contents

- [How It Works](#how-it-works)
- [Usage](#usage)
- [Examples](#examples)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Token and Permissions](#token-and-permissions)
- [Security](#security)
- [Limitations](#limitations)

## How It Works

1. Validates the release tag: a stable version `vX.Y.Z`.  
   Prereleases and build metadata (`v1.2.3-beta.1`, `v1.2.3+build`) fail the
   action.
2. Resolves the commit of the release tag, following annotated tags.  
   A missing tag fails the action.
3. Lists all stable version tags of the repository.
4. For every enabled floating tag (`vX`, `vX.Y`, `latest`):
   - If a higher stable version exists in its line, the tag is kept.  
     A floating tag never moves backward, so releasing a fix for an older line
     does not change `latest`, and a re-run of an old release changes nothing.
   - If the tag already points to the release commit, it is kept.
   - Otherwise, the tag is created or moved to the release commit.
5. Reports the created and moved tags in the output `moved`.

The action never deletes tags and never touches the release tags themselves.

## Usage

Pin the action by commit SHA, with the version as a comment.  
This is recommended: a SHA cannot change.

For convenience, the floating tag `@vX` follows the latest stable release of
major version `X`.  
It moves only forward and only by the release process, but it can change.

Run the action after the release tag exists, for example after creating the
release:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      # … create the tag v1.2.0 and the release …

      - name: 🏷️ Move Floating Version Tags
        uses: simbo-actions/floating-version-tags@<SHA> # vX.Y.Z
        with:
          token: ${{ github.token }}
          tag: v1.2.0
```

## Examples

### Major, Minor, and Latest

```yaml
- name: 🏷️ Move Floating Version Tags
  uses: simbo-actions/floating-version-tags@<SHA> # vX.Y.Z
  with:
    token: ${{ github.token }}
    tag: ${{ github.ref_name }}
    major: true
    minor: true
    latest: true
```

For `v1.2.3`, this moves `v1`, `v1.2`, and `latest`, each only if `v1.2.3` is
the highest stable version of its line.

### Tags in Another Repository

```yaml
- name: 🏷️ Move Floating Version Tags
  uses: simbo-actions/floating-version-tags@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: my-org/my-action
    tag: v2.0.0
```

### Check First

```yaml
- name: 🏷️ Show Floating Tag Changes
  id: floating
  uses: simbo-actions/floating-version-tags@<SHA> # vX.Y.Z
  with:
    token: ${{ github.token }}
    tag: v2.0.0
    dry-run: true

- name: 📋 Report
  env:
    MOVED: ${{ steps.floating.outputs.moved }}
  run: echo "Would move: ${MOVED}"
```

## Inputs

| Input        | Description                                                                         | Required | Default                    |
| ------------ | ----------------------------------------------------------------------------------- | -------- | -------------------------- |
| `token`      | The token to authenticate with, see [Token and Permissions](#token-and-permissions) | true     |                            |
| `repository` | The repository of the tags (`owner/repo`)                                           | false    | `${{ github.repository }}` |
| `tag`        | The existing release tag `vX.Y.Z`; prereleases are rejected                         | true     |                            |
| `major`      | Whether to move the major tag `vX`                                                  | false    | `true`                     |
| `minor`      | Whether to move the minor tag `vX.Y`                                                | false    | `false`                    |
| `latest`     | Whether to move the tag `latest`                                                    | false    | `false`                    |
| `dry-run`    | Whether to only report the changes without writing them                             | false    | `false`                    |

At least one of `major`, `minor`, and `latest` must be `true`.

## Outputs

| Output  | Description                                                                               |
| ------- | ----------------------------------------------------------------------------------------- |
| `moved` | The floating tags that were created or moved (or would be, with `dry-run`), as JSON array |

## Token and Permissions

- **`GITHUB_TOKEN`:** works with `permissions: contents: write` for tags in the
  same repository.  
  Tags created with it do not trigger other workflows.
- **GitHub App installation token:** for tags in other repositories, with
  `contents: write` on that repository.

If a ruleset protects the floating tags, the token's actor must be allowed to
bypass it, for example the GitHub App as bypass actor.

## Security

- **Forward only:** a floating tag only moves to the highest stable version of
  its line.  
  A compromised or mistaken run with an older tag cannot move it back.
- **No prereleases:** prereleases and build metadata never get floating tags.
- **Exact target:** the target is the commit of the release tag, resolved via
  the API, never a branch or a commit given as input.
- **No deletion:** the action only creates and moves tags.
- **Protect the tags:** protect `v*` with a ruleset, so that only the release
  process can create, move, or delete them.
- **Token:** used only for the GitHub API; restrict it to the target repository
  and `contents: write`.
- **Verifying a release:** pin the action by the commit SHA of a release tag.  
  Every release has an archive with a `SHA256SUMS` file and build provenance:

  ```sh
  sha256sum --check SHA256SUMS
  gh attestation verify floating-version-tags-vX.Y.Z.tar.gz --repo simbo-actions/actions
  ```

- **Reporting vulnerabilities:** privately, see the
  [security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).

## Limitations

- Only tags `vX.Y.Z` count as versions; tags without the `v` prefix are ignored.
- Floating tags are lightweight tags pointing to the release commit.
- Moving a tag changes what `@vX` resolves to for every consumer at once; there
  is no gradual rollout.

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)
