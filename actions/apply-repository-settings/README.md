# Apply Repository Settings _(GitHub Action)_

A GitHub Action to apply repository settings, rulesets, labels, environments,
and more from a YAML file, writing only what differs.

> [!NOTE]  
> Developed and maintained in the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
> published here automatically.  
> Issues, questions, and contributions go to the monorepo.

Keep the settings of a repository as code: a YAML file describes the intended
state, and the action compares it with the current state and changes only what
differs.  
Run it on a schedule to correct manual changes, or after creating a repository
to set it up.

## Contents

- [How It Works](#how-it-works)
- [Usage](#usage)
- [Configuration](#configuration)
- [Examples](#examples)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Token and Permissions](#token-and-permissions)
- [Security](#security)
- [Limitations](#limitations)

## How It Works

1. Reads and validates the configuration, YAML or JSON.  
   Unknown keys, wrong types, duplicate keys, anchors, and tags fail the action,
   so typos never pass silently.
2. Reads the current settings of the repository.
3. Compares each configured setting with its current value.  
   Rulesets, labels, environments, and autolinks are matched by name; the order
   of rules, bypass actors, and reviewers does not matter.
4. Writes only the settings that differ, and lists every change in the log, the
   job summary, and the output `changes`.  
   With `dry-run: true`, it only lists them.

Settings that are not in the configuration are left unchanged.  
Entries that are not configured, for example other labels, are kept, unless
`prune` deletes them.

## Usage

Pin the action by commit SHA, with the version as a comment.  
This is recommended: a SHA cannot change.

For convenience, the floating tag `@vX` follows the latest stable release of
major version `X`.  
It moves only forward and only by the release process, but it can change.

```yaml
jobs:
  settings:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: 🛎️ Checkout
        uses: actions/checkout@<SHA> # vX.Y.Z
        with:
          persist-credentials: false

      - name: 🔑 Get App Token
        id: app-token
        uses: actions/create-github-app-token@<SHA> # vX.Y.Z
        with:
          client-id: ${{ vars.APP_CLIENT_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          permission-administration: write

      - name: ⚙️ Apply Repository Settings
        uses: simbo-actions/apply-repository-settings@<SHA> # vX.Y.Z
        with:
          token: ${{ steps.app-token.outputs.token }}
          config: .github/repository-settings.yml
```

## Configuration

Every section and every key is optional; only what is configured is applied.  
The file is YAML 1.2, so JSON works as well; comments explain the choices.

```yaml
repository:
  has_issues: true
  has_wiki: false
  allow_squash_merge: true
  allow_merge_commit: false
  allow_rebase_merge: false
  delete_branch_on_merge: true

topics: [github-actions, automation]

security:
  secret_scanning: true
  secret_scanning_push_protection: true
  dependabot_alerts: true
  dependabot_security_updates: true
  private_vulnerability_reporting: true

actions:
  allowed_actions: all
  sha_pinning_required: true
  default_workflow_permissions: read

rulesets:
  - name: Main Branch
    target: branch
    enforcement: active
    conditions:
      ref_name: { include: [refs/heads/main], exclude: [] }
    bypass_actors:
      - { actor_id: 1, actor_type: OrganizationAdmin, bypass_mode: always }
    rules:
      - type: deletion
      - type: non_fast_forward

labels:
  - { name: bug, color: d73a4a, description: Something is broken }
  # Renames "feature" to "enhancement" and keeps it on issues.
  - { name: enhancement, color: a2eeef, old_name: feature }

environments:
  - name: production
    wait_timer: 10
    prevent_self_review: true
    reviewers:
      - { type: Team, id: 1234567 }
    deployment_branch_policy:
      { protected_branches: false, custom_branch_policies: true }
    deployment_policies:
      - { name: main, type: branch }
      - { name: 'v*', type: tag }

autolinks:
  - key_prefix: TICKET-
    url_template: https://tracker.example.com/browse/TICKET-<num>

custom_properties:
  team: platform

immutable_releases: true

prune:
  labels: true
```

| Section              | Keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repository`         | `description`, `homepage` (strings); `has_issues`, `has_pull_requests`, `has_projects`, `has_wiki`, `has_discussions`, `allow_squash_merge`, `allow_merge_commit`, `allow_rebase_merge`, `allow_auto_merge`, `allow_update_branch`, `delete_branch_on_merge`, `web_commit_signoff_required` (booleans); `pull_request_creation_policy`, `squash_merge_commit_title`, `squash_merge_commit_message`, `merge_commit_title`, `merge_commit_message` (strings, as in the API) |
| `topics`             | Up to 20 topics: lowercase letters, digits, and hyphens; replaces all topics                                                                                                                                                                                                                                                                                                                                                                                              |
| `security`           | `secret_scanning`, `secret_scanning_push_protection`, `dependabot_alerts`, `dependabot_security_updates`, `private_vulnerability_reporting` (booleans)                                                                                                                                                                                                                                                                                                                    |
| `actions`            | `enabled`, `sha_pinning_required`, `can_approve_pull_request_reviews` (booleans); `allowed_actions` (`all`, `local_only`, `selected`); `default_workflow_permissions` (`read`, `write`)                                                                                                                                                                                                                                                                                   |
| `rulesets`           | Rulesets as in the [GitHub API](https://docs.github.com/en/rest/repos/rules), each with a unique `name` and an `enforcement` (`active`, `evaluate`, `disabled`); allowed keys: `name`, `target`, `enforcement`, `conditions` (`ref_name`), `rules`, `bypass_actors`                                                                                                                                                                                                       |
| `labels`             | `name`, `color` (six hex digits, `#` optional), `description`, `old_name` (the current name of a label to rename)                                                                                                                                                                                                                                                                                                                                                         |
| `environments`       | `name`; `wait_timer` (minutes, 0 to 43200); `prevent_self_review`; `reviewers` (up to 6, `type` `User` or `Team` and its numeric `id`); `deployment_branch_policy` (`null` for all branches, or `protected_branches` and `custom_branch_policies`, exactly one `true`); `deployment_policies` (`name` patterns with `type` `branch` or `tag`, with `custom_branch_policies: true`)                                                                                        |
| `autolinks`          | `key_prefix`, `url_template` (with `<num>`), `is_alphanumeric` (default `true`)                                                                                                                                                                                                                                                                                                                                                                                           |
| `custom_properties`  | Values of custom properties that the organization defines: a string, a list of strings, or `null` to remove the value                                                                                                                                                                                                                                                                                                                                                     |
| `immutable_releases` | boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `prune`              | `labels`, `rulesets`, `environments`, `autolinks` (booleans, default `false`): delete the entries of the area that are not configured                                                                                                                                                                                                                                                                                                                                     |

- Rulesets, labels, environments, and autolinks are created if missing and
  updated if they differ.  
  Entries that are not configured are kept, unless `prune` is set for the area.
- `actor_id` of a bypass actor: the app ID for `Integration`, `1` for
  `OrganizationAdmin`, the role ID for `RepositoryRole` (for example `5` for
  admins).
- Labels, environments, and autolinks are matched ignoring case.  
  A label with `old_name` is renamed, so issues keep it.
- An environment keeps the settings that are not configured; secrets and
  variables are never read or changed.  
  `deployment_policies` replaces all branch and tag patterns of the environment.
- An autolink cannot be updated via the API; a changed one is deleted and
  created again.
- `prune` needs the section of its area: `prune.labels` without `labels` fails,
  an empty list deletes all entries.  
  Pruning environments also deletes their secrets; run with `dry-run: true`
  first.
- YAML is read strictly: duplicate keys, anchors, aliases, and tags fail the
  action, so that every value is what the file shows.

## Examples

### Check for Drift on a Schedule

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'

jobs:
  settings:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: 🛎️ Checkout
        uses: actions/checkout@<SHA> # vX.Y.Z
        with:
          persist-credentials: false

      - name: 🔑 Get App Token
        id: app-token
        uses: actions/create-github-app-token@<SHA> # vX.Y.Z
        with:
          client-id: ${{ vars.APP_CLIENT_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          permission-administration: write

      - name: ⚙️ Apply Repository Settings
        id: settings
        uses: simbo-actions/apply-repository-settings@<SHA> # vX.Y.Z
        with:
          token: ${{ steps.app-token.outputs.token }}
          config: .github/repository-settings.yml

      - name: 📣 Report Drift
        if: steps.settings.outputs.changed == 'true'
        env:
          CHANGES: ${{ steps.settings.outputs.changes }}
        run: echo "::warning title=Settings Corrected::$CHANGES"
```

### One Configuration for Many Repositories

Configure a new repository with shared settings and its own description:

```yaml
- name: ⚙️ Apply Repository Settings
  uses: simbo-actions/apply-repository-settings@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    repository: my-org/${{ matrix.repository }}
    config: settings/standard.yml
    description: ${{ matrix.description }}
    topics: ${{ matrix.topics }}
```

### Labels Across Repositories

Keep the same labels everywhere and remove the default labels nobody uses:

```yaml
# .github/labels.yml
labels:
  - { name: bug, color: d73a4a, description: Something is broken }
  - { name: enhancement, color: a2eeef, description: New feature or request }
  - { name: dependencies, color: 0366d6, description: Updates of dependencies }
prune:
  labels: true
```

```yaml
- name: 🏷️ Apply Labels
  uses: simbo-actions/apply-repository-settings@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    config: .github/labels.yml
```

Labels alone need only `issues: write`, see
[Token and Permissions](#token-and-permissions).

### Preview Changes

```yaml
- name: 🔍 Preview Repository Settings
  uses: simbo-actions/apply-repository-settings@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    config: .github/repository-settings.yml
    dry-run: true
```

## Inputs

| Input         | Description                                                                         | Required | Default                    |
| ------------- | ----------------------------------------------------------------------------------- | -------- | -------------------------- |
| `token`       | The token to authenticate with, see [Token and Permissions](#token-and-permissions) | true     |                            |
| `repository`  | The repository to configure (`owner/repo`)                                          | false    | `${{ github.repository }}` |
| `config`      | The path to the configuration file, YAML or JSON                                    | true     |                            |
| `description` | Overrides `repository.description` of the configuration                             | false    |                            |
| `homepage`    | Overrides `repository.homepage` of the configuration                                | false    |                            |
| `topics`      | Overrides `topics` of the configuration; separated by whitespace or commas          | false    |                            |
| `dry-run`     | Whether to only report the changes without applying them                            | false    | `false`                    |

## Outputs

| Output    | Description                                                                           |
| --------- | ------------------------------------------------------------------------------------- |
| `changed` | `true` if settings differed (in a dry run: would change), otherwise `false`           |
| `changes` | The changes as JSON: `[{"setting": "repository.has_wiki", "change": "true → false"}]` |

## Token and Permissions

Use a GitHub App installation token restricted to the repository, requested only
for this step; the `GITHUB_TOKEN` cannot get `administration: write`.

| Section                                                                                                      | Permission                                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `repository`, `topics`, `security`, `actions`, `rulesets`, `environments`, `autolinks`, `immutable_releases` | `administration: write`, also to read some settings                                                                |
| `labels`                                                                                                     | `issues: write`                                                                                                    |
| `custom_properties`                                                                                          | permission to edit custom property values: repository admin, or the custom property permission of the organization |

Request only what the configured sections need.  
Administration access allows much more than the action does.

## Security

- **Least privilege:** the action writes only settings that are configured and
  differ; it deletes only with `prune`, and never changes collaborators, teams,
  secrets, variables, or files.
- **Strict configuration:** unknown keys, wrong types, duplicate keys, anchors,
  aliases, and tags fail the action instead of being ignored.  
  Only the listed keys reach the API, so no key can change a request itself.
- **Dry run:** `dry-run: true` shows all changes without applying them.
- **Rate limits:** requests that hit a rate limit wait as long as GitHub asks
  for and are retried up to 4 times (`@octokit/plugin-throttling`).
- **Verifying a release:** pin the action by the commit SHA of a release tag.  
  Every release has an archive with a `SHA256SUMS` file and build provenance:

  ```sh
  sha256sum --check SHA256SUMS
  gh attestation verify apply-repository-settings-vX.Y.Z.tar.gz --repo simbo-actions/actions
  ```

- **Reporting vulnerabilities:** privately, see the
  [security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).

## Limitations

- Only the settings listed in [Configuration](#configuration); no teams,
  collaborators, webhooks, secrets, variables, or files.
- Custom properties must be defined by the organization first.
- Some features depend on the plan: for example, secret scanning and code
  scanning in private repositories need GitHub Advanced Security, and
  environments with protection rules in private repositories need a paid plan.
- Runs on Linux runners only (x64 and arm64).

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)
