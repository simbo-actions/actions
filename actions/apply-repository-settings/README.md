# Apply Repository Settings _(GitHub Action)_

A GitHub Action to apply repository settings, security features, Actions
permissions, and rulesets from a configuration file, writing only what differs.

> [!NOTE]  
> Developed and maintained in the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions) and
> published here automatically. Issues, questions, and contributions go to the
> monorepo.

Keep the settings of a repository as code: a JSON file describes the intended
state, and the action compares it with the current state and changes only what
differs. Run it on a schedule to correct manual changes, or after creating a
repository to set it up.

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

1. Reads and validates the configuration. Unknown keys and wrong types fail the
   action, so typos never pass silently.
2. Reads the current settings of the repository.
3. Compares each configured setting with its current value. Rulesets are matched
   by name; the order of rules and bypass actors does not matter.
4. Writes only the settings that differ, and lists every change in the log and
   the output `changes`. With `dry-run: true`, it only lists them.

Settings that are not in the configuration are left unchanged.

## Usage

Pin the action by commit SHA, with the version as a comment:

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
          config: .github/repository-settings.json
```

## Configuration

Every section and every key is optional; only what is configured is applied.

```json
{
  "repository": {
    "has_issues": true,
    "has_pull_requests": true,
    "has_wiki": false,
    "allow_squash_merge": true,
    "allow_merge_commit": false,
    "allow_rebase_merge": false,
    "allow_auto_merge": true,
    "allow_update_branch": true,
    "delete_branch_on_merge": true
  },
  "topics": ["github-actions", "automation"],
  "security": {
    "secret_scanning": true,
    "secret_scanning_push_protection": true,
    "dependabot_alerts": true,
    "dependabot_security_updates": true,
    "private_vulnerability_reporting": true
  },
  "actions": {
    "enabled": true,
    "allowed_actions": "all",
    "sha_pinning_required": true,
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "rulesets": [
    {
      "name": "Main Branch",
      "target": "branch",
      "enforcement": "active",
      "conditions": {
        "ref_name": { "include": ["refs/heads/main"], "exclude": [] }
      },
      "bypass_actors": [
        {
          "actor_id": 1,
          "actor_type": "OrganizationAdmin",
          "bypass_mode": "always"
        }
      ],
      "rules": [
        { "type": "deletion" },
        { "type": "non_fast_forward" },
        { "type": "required_linear_history" }
      ]
    }
  ],
  "immutable_releases": true
}
```

| Section              | Keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repository`         | `description`, `homepage` (strings); `has_issues`, `has_pull_requests`, `has_projects`, `has_wiki`, `has_discussions`, `allow_squash_merge`, `allow_merge_commit`, `allow_rebase_merge`, `allow_auto_merge`, `allow_update_branch`, `delete_branch_on_merge`, `web_commit_signoff_required` (booleans); `pull_request_creation_policy`, `squash_merge_commit_title`, `squash_merge_commit_message`, `merge_commit_title`, `merge_commit_message` (strings, as in the API) |
| `topics`             | Up to 20 topics: lowercase letters, digits, and hyphens; replaces all topics                                                                                                                                                                                                                                                                                                                                                                                              |
| `security`           | `secret_scanning`, `secret_scanning_push_protection`, `dependabot_alerts`, `dependabot_security_updates`, `private_vulnerability_reporting` (booleans)                                                                                                                                                                                                                                                                                                                    |
| `actions`            | `enabled`, `sha_pinning_required`, `can_approve_pull_request_reviews` (booleans); `allowed_actions` (`all`, `local_only`, `selected`); `default_workflow_permissions` (`read`, `write`)                                                                                                                                                                                                                                                                                   |
| `rulesets`           | Rulesets as in the [GitHub API](https://docs.github.com/en/rest/repos/rules), each with a unique `name` and an `enforcement` (`active`, `evaluate`, `disabled`)                                                                                                                                                                                                                                                                                                           |
| `immutable_releases` | boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

- Rulesets are created if missing and updated if they differ. Rulesets that are
  not configured are kept.
- `actor_id` of a bypass actor: the app ID for `Integration`, `1` for
  `OrganizationAdmin`, the role ID for `RepositoryRole` (for example `5` for
  admins).

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
          config: .github/repository-settings.json

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
    config: settings/standard.json
    description: ${{ matrix.description }}
    topics: ${{ matrix.topics }}
```

### Preview Changes

```yaml
- name: 🔍 Preview Repository Settings
  uses: simbo-actions/apply-repository-settings@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    config: .github/repository-settings.json
    dry-run: true
```

## Inputs

| Input         | Description                                                                         | Required | Default                    |
| ------------- | ----------------------------------------------------------------------------------- | -------- | -------------------------- |
| `token`       | The token to authenticate with, see [Token and Permissions](#token-and-permissions) | true     |                            |
| `repository`  | The repository to configure (`owner/repo`)                                          | false    | `${{ github.repository }}` |
| `config`      | The path to the JSON configuration file                                             | true     |                            |
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

The action needs **`administration: write`** on the repository, even to read
some settings (security features, rulesets). Use a GitHub App installation token
restricted to the repository; the `GITHUB_TOKEN` cannot get this permission.

Request the token only for this step. Administration access allows much more
than the action does.

## Security

- **Least privilege:** the action writes only settings that are configured and
  differ; it never deletes rulesets or changes collaborators, teams, secrets, or
  files.
- **Strict configuration:** unknown keys and wrong types fail the action instead
  of being ignored.
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

- Only the settings listed in [Configuration](#configuration); no labels, teams,
  collaborators, environments, webhooks, or files.
- Rulesets that are not configured are kept, not deleted.
- Some features depend on the plan: for example, secret scanning and code
  scanning in private repositories need GitHub Advanced Security.
- The configuration is JSON; YAML is not supported.

## Source Repository

> [!NOTE]
>
> Only the build artifacts for this action are provided in the repository
> [`simbo-actions/apply-repository-settings`](https://github.com/simbo-actions/apply-repository-settings).
>
> The source repository for this action is
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions).
>
> 💁‍♂️ For issues and contributions, please refer to the source repository.

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)
