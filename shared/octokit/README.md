# 🔄 Simbo's Actions — Shared Octokit Client

Internal package of this monorepo, bundled into the actions. Not published.

`createOctokit(token)` returns the Octokit client of `@actions/github` with the
official plugin
[`@octokit/plugin-throttling`](https://github.com/octokit/plugin-throttling.js):
requests that hit the primary or secondary rate limit wait as long as GitHub
asks for and are retried up to 4 times, with a warning in the log.
