# Commit and Push _(GitHub Action)_

A GitHub Action to commit and push changes to a repository. Supports user
config, commit signing, and tagging.

> [!NOTE]  
> This action is kept for existing workflows only and will be removed. Use
> [`signed-commit`](../signed-commit/README.md) instead.

## Usage

This action is not published to a repository of its own. Use it from this
monorepo, pinned by commit SHA:

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    steps:
      - name: Commit and Push Changes
        uses: simbo-actions/actions/actions/commit-and-push@<SHA>
        with:
          message: 'ci(release): ${{ env.VERSION }}'
          tags: ${{ env.VERSION }}
```

## Inputs

| Input                 | Description                                                       | Required | Default                                        |
| --------------------- | ----------------------------------------------------------------- | -------- | ---------------------------------------------- |
| `message`             | The commit message                                                | true     |                                                |
| `add`                 | The files to add (git add)                                        | false    | `.`                                            |
| `tags`                | The tags to apply to the commit (optional, white-space separated) | false    |                                                |
| `remote`              | The remote to push to                                             | false    | `origin`                                       |
| `ref`                 | The branch or ref to push to                                      | false    | `${{ github.ref_name }}`                       |
| `name`                | The name to use for the commit author                             | false    | `GitHub Actions`                               |
| `email`               | The email to use for the commit author                            | false    | `github-actions[bot]@users.noreply.github.com` |
| `signing-key-private` | The private SSH key for commit signing                            | false    |                                                |
| `signing-key-public`  | The public SSH key for commit signing                             | false    |                                                |
| `path`                | The working directory to run the action in                        | false    | `.`                                            |

## Outputs

🤷‍♂️ This action does not produce any outputs.

## Source Repository

> [!NOTE]
>
> The source of this action is part of the monorepo
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions).
>
> 💁‍♂️ For issues and contributions, please refer to the monorepo.

## License

[MIT © Simon Lepel](http://simbo.mit-license.org/2025/)
