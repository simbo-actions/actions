# GitHub App Bot User _(GitHub Action)_

A GitHub Action to get the bot user of a GitHub App, with user ID, login, name,
and email for Git.

Every GitHub App acts as a bot user named `<app-slug>[bot]`. This action looks
up that user and provides its user ID and the Git identity GitHub expects for
commits by the app, for example `123+my-app[bot]@users.noreply.github.com`.
Combined with
[`actions/create-github-app-token`](https://github.com/actions/create-github-app-token),
it gives a workflow both the token and the identity of the app.

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

1. Takes the app slug, for example the output `app-slug` of
   `actions/create-github-app-token`. A `[bot]` suffix is removed.
2. Requests the public user `<app-slug>[bot]` from the GitHub API and checks
   that it is a bot user with that login.
3. Provides user ID, login, name, email, and the author string `Name <email>` as
   outputs.

GitHub links commits to a bot user by the noreply email
`<user ID>+<login>@users.noreply.github.com`. With that email, commits show the
app's avatar and link to the app.

## Usage

Pin the action by commit SHA, with the version as a comment:

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: 🔑 Get App Token
        id: app-token
        uses: actions/create-github-app-token@<SHA> # vX.Y.Z
        with:
          client-id: ${{ vars.APP_CLIENT_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: 🤖 Get App Bot User
        id: bot-user
        uses: simbo-actions/github-app-bot-user@<SHA> # vX.Y.Z
        with:
          app-slug: ${{ steps.app-token.outputs.app-slug }}

      - name: 📣 Show Bot User
        env:
          AUTHOR: ${{ steps.bot-user.outputs.author }}
        run: echo "Acting as $AUTHOR"
```

## Examples

### Git Identity for Commits

Configure Git to commit as the app, for example before pushing to a deployment
branch:

```yaml
- name: 🪪 Configure Git
  env:
    NAME: ${{ steps.bot-user.outputs.name }}
    EMAIL: ${{ steps.bot-user.outputs.email }}
  run: |
    git config user.name "$NAME"
    git config user.email "$EMAIL"
```

Commits created with Git this way are not signed. For verified commits, create
them via the GitHub API, for example with
[`simbo-actions/signed-commit`](https://github.com/simbo-actions/signed-commit).

### Inputs of Other Actions

Many actions accept a Git name and email, for example for deployments:

```yaml
- name: 🚀 Deploy
  uses: JamesIves/github-pages-deploy-action@<SHA> # vX.Y.Z
  with:
    token: ${{ steps.app-token.outputs.token }}
    folder: dist
    git-config-name: ${{ steps.bot-user.outputs.name }}
    git-config-email: ${{ steps.bot-user.outputs.email }}
```

### Co-Author Trailer

Credit the app as co-author in a commit message created by another tool:

```yaml
- name: 📝 Prepare Commit Message
  id: message
  env:
    AUTHOR: ${{ steps.bot-user.outputs.author }}
  run: |
    {
      echo 'message<<EOF'
      echo 'chore: update generated files'
      echo
      echo "Co-authored-by: $AUTHOR"
      echo 'EOF'
    } >> "$GITHUB_OUTPUT"
```

### Without a Token Step

The bot user is public, so the slug can also be given directly:

```yaml
- name: 🤖 Get App Bot User
  id: bot-user
  uses: simbo-actions/github-app-bot-user@<SHA> # vX.Y.Z
  with:
    app-slug: my-app
```

## Inputs

| Input      | Description                                                                   | Required | Default               |
| ---------- | ----------------------------------------------------------------------------- | -------- | --------------------- |
| `app-slug` | The slug of the GitHub App, for example `my-app`; a `[bot]` suffix is allowed | true     |                       |
| `token`    | The token for the API request; any token works                                | false    | `${{ github.token }}` |

## Outputs

| Output   | Description                                 | Example                                                  |
| -------- | ------------------------------------------- | -------------------------------------------------------- |
| `id`     | The user ID of the bot user                 | `123`                                                    |
| `login`  | The login of the bot user                   | `my-app[bot]`                                            |
| `name`   | The name for Git commits, same as the login | `my-app[bot]`                                            |
| `email`  | The noreply email for Git commits           | `123+my-app[bot]@users.noreply.github.com`               |
| `author` | Name and email in the format `Name <email>` | `my-app[bot] <123+my-app[bot]@users.noreply.github.com>` |

None of the outputs is secret.

## Token and Permissions

- The bot user is public. The action needs no permissions and no app
  credentials; it never handles a private key.
- The default `github.token` works even with `permissions: {}` and avoids the
  low rate limit of unauthenticated requests.
- The API URL follows the runner (`GITHUB_API_URL`), so the action also works
  with GitHub Enterprise Server.

## Security

- **No credentials:** the action reads a public user and needs no app key and no
  permissions. It never handles a private key.
- **Inputs:** the app slug is validated; the action checks that the user found
  is the bot user of exactly this app.
- **Outputs:** none of the outputs is secret.
- **Verifying a release:** pin the action by the commit SHA of a release tag.
  Every release has an archive with a `SHA256SUMS` file and build provenance:

  ```sh
  sha256sum --check SHA256SUMS
  gh attestation verify github-app-bot-user-vX.Y.Z.tar.gz --repo simbo-actions/actions
  ```

- **Reporting vulnerabilities:** privately, see the
  [security policy](https://github.com/simbo-actions/actions/blob/main/SECURITY.md).

## Limitations

- The action does not create tokens; use `actions/create-github-app-token` for
  that.
- It fails if no bot user exists for the slug, or if the user found is not a
  bot.

## Source Repository

> [!NOTE]
>
> Only the build artifacts for this action are provided in the repository
> [`simbo-actions/github-app-bot-user`](https://github.com/simbo-actions/github-app-bot-user).
>
> The source repository for this action is
> [`simbo-actions/actions`](https://github.com/simbo-actions/actions).
>
> 💁‍♂️ For issues and contributions, please refer to the source repository.

## License

[MIT © Simon Lepel](https://simbo.mit-license.org/@2026)
