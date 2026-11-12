# Signed Commit _(GitHub Action)_

A GitHub Action to create signed commits and tags via the GitHub API, shown as
verified.

Instead of `git commit` and `git push`, the action sends the changes to the
GitHub GraphQL API (`createCommitOnBranch`). GitHub creates and signs the
commit, so it shows as **"Verified"** without any signing keys. It supports
added, changed, and deleted files, detects changes from Git, creates tags, and
updates the local checkout afterwards.

## Contents

- [How It Works](#how-it-works)
- [Usage](#usage)
- [Examples](#examples)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Token and Permissions](#token-and-permissions)
- [Detecting Changes](#detecting-changes)
- [Protection Against Overwriting](#protection-against-overwriting)
- [Tags](#tags)
- [Syncing the Local Checkout](#syncing-the-local-checkout)
- [Rate Limits](#rate-limits)
- [Empty Repositories and Missing Branches](#empty-repositories-and-missing-branches)
- [Limitations](#limitations)

## How It Works

1. Reads the head of the target branch via the API and checks it against the
   expected head (by default the local `HEAD`).
2. Collects the files to commit: explicit `additions` and `deletions`, plus the
   changes detected by Git (`detect-changes`).
3. Creates the commit with `createCommitOnBranch`. The author is the identity of
   the token, for example `my-app[bot]`; GitHub signs the commit.
4. Creates the `tags` on the new commit, one API call per tag.
5. Updates the local checkout (`sync`): fetches the branch and moves `HEAD` to
   the new commit, without touching any files.

Why: commits signed locally with a signing key of a bot are only verified if the
key belongs to a user account. Commits created by GitHub via the API are always
verified, also for GitHub Apps, and satisfy the ruleset rule "Require signed
commits".

## Usage

Pin the action by commit SHA, with the version as a comment:

```yaml
jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: 🪪 Get App Token
        id: app-token
        uses: actions/create-github-app-token@<SHA> # vX.Y.Z
        with:
          client-id: ${{ vars.APP_CLIENT_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          permission-contents: write

      - name: 🛎️ Checkout
        uses: actions/checkout@<SHA> # vX.Y.Z
        with:
          token: ${{ steps.app-token.outputs.token }}

      - name: 🛠️ Generate Files
        run: ./scripts/generate.sh

      - name: 💾 Commit Changes
        uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
        with:
          token: ${{ steps.app-token.outputs.token }}
          message: 'chore: update generated files'
```

This commits all changes in the working tree, including untracked files, to the
checked out branch.

## Examples

### Release Commit with Tags

Commit version bumps and create one tag per released package. Every tag is
created with its own API call and triggers its own `push` event, so a workflow
on `push: tags` runs once per tag:

```yaml
- name: 💾 Commit Release and Create Tags
  id: commit
  uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    branch: main
    message: 'ci(release): pkg-a/v1.2.0 pkg-b/v2.0.1'
    tags: pkg-a/v1.2.0 pkg-b/v2.0.1

- name: 📣 Show Commit
  env:
    SHA: ${{ steps.commit.outputs.commit-sha }}
  run: echo "Released with commit $SHA"
```

### Only Staged Changes

Stage exactly what should be committed and leave everything else alone:

```yaml
- name: ➕ Stage Changes
  run: git add CHANGELOG.md package.json

- name: 💾 Commit Staged Changes
  uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    message: 'docs: update changelog'
    detect-changes: staged
```

### Explicit Files

Commit specific files without detecting changes. The working directory does not
need to be a Git repository:

```yaml
- name: 💾 Commit Files
  uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    message: 'chore: update reports'
    detect-changes: none
    additions: |
      reports/summary.json
      reports/details.md
    deletions: |
      reports/outdated.md
```

### Another Repository

Check out the other repository into a subdirectory and commit there. The token
must have access to that repository:

```yaml
- name: 🛎️ Checkout Target Repository
  uses: actions/checkout@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: my-org/target
    path: target

- name: 🧩 Copy Files
  run: cp -R dist/. target/

- name: 💾 Commit to Target Repository
  uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: my-org/target
    branch: main
    working-directory: target
    message: 'ci(release): v1.0.0'
    tags: v1.0.0
```

### Allow Empty Runs

Do not fail a scheduled job when nothing changed:

```yaml
- name: 💾 Commit Changes If Any
  id: commit
  uses: simbo-actions/signed-commit@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    message: 'chore: update data'
    if-no-changes: ignore

- name: 📣 Report
  if: steps.commit.outputs.committed == 'true'
  run: echo "Committed ${{ steps.commit.outputs.commit-sha }}"
```

## Inputs

| Input               | Description                                                                                      | Required | Default                    |
| ------------------- | ------------------------------------------------------------------------------------------------ | -------- | -------------------------- |
| `token`             | The token to authenticate with, see [Token and Permissions](#token-and-permissions)              | true     |                            |
| `message`           | The commit message; first line is the headline, the remaining lines are the body                 | true     |                            |
| `repository`        | The repository to commit to (`owner/repo`)                                                       | false    | `${{ github.repository }}` |
| `branch`            | The existing branch to commit to                                                                 | false    | `${{ github.ref_name }}`   |
| `working-directory` | The directory with the files; must be the repository root when detecting changes                 | false    | `.`                        |
| `additions`         | Files to add or update, one path per line, relative to `working-directory`                       | false    |                            |
| `deletions`         | Files to delete, one path per line, relative to `working-directory`                              | false    |                            |
| `detect-changes`    | `all` (working tree), `staged` (index), or `none`, see [Detecting Changes](#detecting-changes)   | false    | `all`                      |
| `tags`              | Tags to create on the new commit, separated by whitespace                                        | false    |                            |
| `if-no-changes`     | `error`, `warn`, or `ignore` when there is nothing to commit                                     | false    | `error`                    |
| `sync`              | Whether to update the local checkout after the commit                                            | false    | `true`                     |
| `expected-head-oid` | The SHA the branch must point to, or `remote`, see [Protection](#protection-against-overwriting) | false    | local `HEAD`               |

> [!NOTE]  
> `branch` defaults to `github.ref_name`. In workflows triggered by tags or pull
> requests, that is not a branch; set `branch` explicitly there.

## Outputs

| Output       | Description                                                          |
| ------------ | -------------------------------------------------------------------- |
| `committed`  | `true` if a commit was created, otherwise `false`                    |
| `commit-sha` | The SHA of the new commit; empty if no commit was created            |
| `files`      | The committed paths as JSON: `{"additions": [...], "deletions": []}` |

`files` lists added and changed files under `additions`. Read it with
`fromJSON()`, for example
`${{ join(fromJSON(steps.commit.outputs.files).additions, ', ') }}`.

## Token and Permissions

- **GitHub App installation token (recommended):** the commit author is the
  app's bot user, and the commit and tags trigger other workflows. Request only
  what the job needs:
  - `contents: write` for commits and tags.
  - `workflows: write` additionally, if files under `.github/workflows/` change.
- **`GITHUB_TOKEN`:** works with `permissions: contents: write`. The author is
  `github-actions[bot]`, and as with every change made with this token, the
  commit and the tags do not trigger other workflows.
- **Rulesets:** the commit is subject to the rules of the branch. If the branch
  requires pull requests or status checks, the token's identity needs a bypass.
  "Require signed commits" is satisfied without a bypass. Protected tags need a
  bypass as well.

## Detecting Changes

`detect-changes` decides which Git changes are committed in addition to the
explicit `additions` and `deletions`:

| Mode     | Source                                        | Untracked files | Contents from |
| -------- | --------------------------------------------- | --------------- | ------------- |
| `all`    | Staged and unstaged changes                   | Yes             | Working tree  |
| `staged` | Only staged changes (`git add`)               | No              | Index         |
| `none`   | Only the explicit `additions` and `deletions` | –               | Working tree  |

- The commit reflects the state of each changed path: a file that exists is
  added or updated, a file that no longer exists is deleted.
- Untracked directories are expanded into their files. Files ignored by
  `.gitignore` are never committed.
- Renames become a deletion of the old path and an addition of the new path. The
  source of a copy stays unchanged.
- With `all`, a partially staged file is committed with its working tree
  contents; with `staged`, with its staged contents.
- Explicit `additions` and `deletions` take precedence over detected changes for
  the same path. A path must not be in both lists.
- When detecting changes, `working-directory` must be the root of the Git
  repository. Paths in the commit are relative to it.

## Protection Against Overwriting

`createCommitOnBranch` only succeeds if the branch still points to the expected
commit. This prevents a commit based on an outdated checkout from silently
overwriting newer changes on the branch.

- **Default:** the expected head is the local `HEAD` of the working directory.
  If the branch has moved since the checkout, the action fails before creating
  the commit.
- **Outside of a Git repository** or in a repository without commits, the
  current remote head is used.
- **`expected-head-oid: <sha>`** uses the given commit SHA.
- **`expected-head-oid: remote`** always commits on top of the current remote
  head. Use it when the working directory is not a checkout of the target
  branch, and only if the files cannot conflict with newer changes.

## Tags

- Tags are lightweight and point to the new commit. A tag created by the API as
  annotated tag object would itself be unsigned; a lightweight tag shows the
  verified commit.
- Every tag is created with its own API call, in the given order, so every tag
  triggers its own `push` event. Pushing more than three tags at once with Git
  creates no events for them.
- An existing tag that already points to the new commit is accepted. An existing
  tag on another commit fails the action.
- Without a commit (nothing to commit), no tags are created.

## Syncing the Local Checkout

The commit exists only on GitHub at first. With `sync: true` (default), the
action updates the local checkout so that following steps see the new commit:

1. `git fetch origin <branch>`
2. `git reset --mixed <new commit>`: moves `HEAD` and the index; files in the
   working tree stay unchanged, including files that were not committed.
3. Creates the tags locally, unless they already exist.

The sync is skipped if the working directory is not a Git repository or its
`HEAD` is not the parent of the new commit, for example with
`expected-head-oid: remote`. If fetching fails, the action only warns; the
commit itself was created. Fetching uses the remote `origin` and the credentials
of the checkout.

## Rate Limits

GitHub limits API requests per identity, shared by all workflow runs that use
the same token identity, for example all repositories using the same GitHub App:

- **Primary rate limit:** 5,000 requests per hour for an installation token
  (more for large organizations), 1,000 per hour per repository for
  `GITHUB_TOKEN`. A run needs one request to read the branch, one for the
  commit, and one per tag.
- **Secondary rate limit for creating content:** at most 80 requests per minute
  and 500 per hour. Every commit and every tag counts.

When GitHub reports a rate limit, the action waits as long as GitHub asks for
(`retry-after`, or until `x-ratelimit-reset`; one minute if GitHub gives no
time) and retries the request, up to 5 attempts. It fails instead if GitHub asks
to wait more than 15 minutes. Requests run one after another, never in parallel,
as GitHub recommends.

With more than 80 tags in one run, the action warns before creating them: the
run may slow down, but every tag is still created with its own request and
triggers its own `push` event. Many parallel runs, for example one publish run
per tag of a large release, share the same limits; spread them, for example with
a matrix and `max-parallel`.

## Empty Repositories and Missing Branches

`createCommitOnBranch` needs an existing branch; the action does not create
branches. In an empty repository, create an initial commit first, for example by
creating the repository with `auto_init`. That initial commit is created by
GitHub and is verified as well.

## Limitations

- **Symbolic links and submodules** are not supported; the action fails.
- **The executable bit** is not preserved; the action warns. New files are
  created as regular files.
- **Commit metadata** such as author, committer, and date is set by GitHub.
- **Size:** all file contents are sent base64-encoded in one API request. Very
  large commits may be rejected by the API; split them into several commits.
- **Merge commits** cannot be created.

## Source Repository

> [!NOTE]
>
> Only the build artifacts for this action are provided in the repository
> [`simbo-actions/signed-commit`](https://github.com/simbo-actions/signed-commit).
>
> The source repository for this action is
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions).
>
> 💁‍♂️ For issues and contributions, please refer to the source repository.

## License

[MIT © Simon Lepel](http://simbo.mit-license.org/2025/)
