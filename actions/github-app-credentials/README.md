# GitHub App Credentials _(GitHub Action)_

A GitHub Action to obtain token, slug, user ID, name, and email for a GitHub
App.

## Usage

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    steps:
      - name: Get GitHub App Credentials
        uses: simbo-actions/github-app-credentials@v1
        with:
          app-id: ${{ secrets.GITHUB_APP_ID }}
          app-private-key: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}
          # Optional: owner: 'my-org' # defaults to the repository owner
```

## Inputs

| Input             | Description                                 | Required | Default                          |
| ----------------- | ------------------------------------------- | -------- | -------------------------------- |
| `app-id`          | The GitHub App ID                           | true     |                                  |
| `app-private-key` | The GitHub App private key in PEM format    | true     |                                  |
| `owner`           | The GitHub App owner (user or organization) | false    | `${{ github.repository_owner }}` |

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
> Only the build artifacts for this action are provided in the repository
> [`simbo-actions/github-app-credentials`](https://github.com/simbo-actions/github-app-credentials).
>
> The source repository for this action is
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions).
>
> 💁‍♂️ For issues and contributions, please refer to the source repository.

## License

[MIT © Simon Lepel](http://simbo.mit-license.org/2025/)
