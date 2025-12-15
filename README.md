# 🔄 Simbo's Actions

> A monorepo for my GitHub Actions.

> [!NOTE]  
> This repository is in the early stages of development. What is described here
> may significantly change in the future or may not even be implemented at all.

## About

This repository contains a collection of GitHub Actions developed and maintained
by Simon Lepel ([simbo](http://github.com/simbo)).

All actions are automatically published to their respective repositories under
the [simbo-actions](http://github.com/simbo-actions) organization and can be
easily integrated into your own GitHub workflows.

The generic usage pattern for an action from this monorepo is as follows:

```yaml
jobs:
  example_job:
    runs-on: ubuntu-latest
    steps:
      - name: Use Simbo's Action
        uses: simbo-actions/<ACTION>@vX.Y.Z
        with:
          # action-specific inputs
```

## Further Information

- [**`CONTRIBUTING.md`**](./CONTRIBUTING.md)  
  _Development and contribution guidelines_

- [**`CONCEPT.md`**](./CONCEPT.md)  
  _Intention and conceptual overview_

## License

[MIT © Simon Lepel](http://simbo.mit-license.org/2025/)
