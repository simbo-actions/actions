# GitHub App Credentials _(GitHub Action)_

A GitHub Action to obtain token, slug, user ID, name, and email for a GitHub
App.

## Usage

This action is not published to a repository of its own. Use it from this
monorepo, pinned by commit SHA:

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    steps:
      - name: Get GitHub App Credentials
        uses: simbo-actions/actions/actions/github-app-credentials@<SHA>
        with:
          client-id: ${{ secrets.GITHUB_APP_CLIENT_ID }}
          app-private-key: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}
          # Optional: restrict the token's permissions
          permission-contents: write
```

By default, the token is restricted to the current repository. Request only the
permissions a job needs; without any `permission-*` input, the token gets all
permissions of the installation.

## Inputs

| Input             | Description                                                                  | Required | Default                          |
| ----------------- | ---------------------------------------------------------------------------- | -------- | -------------------------------- |
| `app-id`          | The GitHub App ID (use either `app-id` or `client-id`)                       | false    |                                  |
| `client-id`       | The GitHub App client ID (use either `app-id` or `client-id`)                | false    |                                  |
| `app-private-key` | The GitHub App private key in PEM format                                     | true     |                                  |
| `owner`           | The GitHub App installation owner (user or organization)                     | false    | `${{ github.repository_owner }}` |
| `repositories`    | Repositories the token is restricted to (comma or newline separated, `*`)    | false    | current repository               |
| `permission-*`    | Permissions of the token (`read` or `write`), see [`action.yml`](action.yml) | false    |                                  |

`repositories` defaults to the current repository only if `owner` is the current
repository owner. For another owner, it defaults to all repositories of that
installation. `*` always means all repositories of the installation.

## Outputs

| Output  | Description               |
| ------- | ------------------------- |
| `token` | The GitHub App token      |
| `slug`  | The GitHub App slug       |
| `id`    | The GitHub App user ID    |
| `name`  | The GitHub App user name  |
| `email` | The GitHub App user email |

## Source Repository

> [!NOTE]
>
> The source of this action is part of the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions).
>
> 💁‍♂️ For issues and contributions, please refer to the monorepo.

## License

[MIT © Simon Lepel](http://simbo.mit-license.org/2025/)
