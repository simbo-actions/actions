# 🔄 Simbo's Actions

> A monorepo for my GitHub Actions.

> [!NOTE]  
> This repository is in the early stages of development. What is described here
> may significantly change in the future or may not even be implemented at all.

## About

This repository contains a collection of GitHub Actions developed and maintained
by Simon Lepel ([simbo](http://github.com/simbo)).

Actions are automatically published to their respective repositories under the
[simbo-actions](http://github.com/simbo-actions) organization and can be easily
integrated into your own GitHub workflows.

The generic usage pattern for an action from this monorepo is as follows. Pin
the action by the commit SHA of a release tag, with the version as a comment:

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    steps:
      - name: Use Simbo's Action
        uses: simbo-actions/<ACTION>@<SHA> # vX.Y.Z
        with:
          # action-specific inputs
```

Actions that are not published to a repository of their own are used from this
monorepo, pinned by commit SHA: `simbo-actions/actions/actions/<ACTION>@<SHA>`.
[`ACTIONS.md`](https://github.com/simbo-actions/actions/blob/main/ACTIONS.md)
shows how to use each action.

## Actions

<!-- PACKAGES -->

There are currently _**3**_ GitHub Actions managed in this repository.

<!-- /PACKAGES -->

See the
[`ACTIONS.md`](https://github.com/simbo-actions/actions/blob/main/ACTIONS.md)
for a comprehensive list of all packages.

## Further Information

- [**`CONTRIBUTING.md`**](https://github.com/simbo-actions/actions/blob/main/CONTRIBUTING.md)  
  _Development
  and contribution guidelines_

- [**`CONCEPT.md`**](https://github.com/simbo-actions/actions/blob/main/CONCEPT.md)  
  _Intention
  and conceptual overview_

## License

[MIT © Simon Lepel](http://simbo.mit-license.org/2025/)
