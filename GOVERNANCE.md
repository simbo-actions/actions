# 🔄 Simbo's Actions — Governance

How decisions are made, who has which role, and who can access what.

## Decisions

The project has one maintainer, who makes the decisions.

- Proposals come as issues or pull requests; everyone can make them.
- Changes are made in pull requests, held against [STANDARDS.md](STANDARDS.md),
  and merged only with all required checks.
- Changes to the standards, the architecture, or this document are made the same
  way, in a pull request that explains the reason.
- Plans for the next year are in [ROADMAP.md](ROADMAP.md).

## Roles

| Role        | Who                                                | Responsibilities                                                                                                                                                     |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintainer  | [Simon Lepel](https://github.com/simbo) (`@simbo`) | Decides on proposals, reviews and merges pull requests, handles security reports ([SECURITY.md](SECURITY.md)), keeps the runbooks ([MAINTAINING.md](MAINTAINING.md)) |
| Contributor | Anyone                                             | Reports issues, proposes and makes changes as described in [CONTRIBUTING.md](CONTRIBUTING.md)                                                                        |
| Automation  | The GitHub Apps of the organization, Dependabot    | Releases and publishes actions, runs the integration tests, proposes dependency updates; see [ARCHITECTURE.md](ARCHITECTURE.md)                                      |

## Access to Sensitive Resources

| Resource                                                                                      | Access                                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Organization `simbo-actions`: settings, rulesets, Actions policy                              | The maintainer, as the only organization owner                                                      |
| Repositories of the organization                                                              | The maintainer; members get read access by default                                                  |
| Environment `release` with the key of the app `simbo-actions`                                 | Jobs on `main` and release tags; the app writes to the monorepo and the action repositories         |
| Environments `smoke-test` and `smoke-test-pr` with the key of the app `simbo-actions-sandbox` | Jobs on `main`, and pull requests after the maintainer's approval; the app reaches only the sandbox |
| GitHub App registrations and their private keys                                               | The maintainer                                                                                      |
| GitHub Marketplace listings and the OpenSSF Best Practices entry                              | The maintainer                                                                                      |

The organization requires two-factor authentication.  
The permissions of the apps and of every job are described in
[ARCHITECTURE.md](ARCHITECTURE.md#identity-tokens-and-permissions).

## Granting Access

Write access or a role with access to sensitive resources is granted only to a
person who has contributed over a longer time, after the maintainer has reviewed
their contributions and their account, and only with two-factor
authentication.  
Access is granted with the least privilege the role needs, documented in this
file, and removed when it is no longer needed.  
With a second person with write access, the ruleset "Main Branch" requires one
approval of the last push for every pull request, so that every change is
reviewed by someone other than its author.
