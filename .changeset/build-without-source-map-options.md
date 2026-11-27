---
'changelog': patch
---

Leave source maps and declarations to the shared Rollup configuration.

- The `tsconfig.build.json` of every action no longer sets `declaration`,
  `sourceMap`, and `inlineSources` to `false`.
- `@simbo/rollup-github-actions-config` 3.0.1 disables them for the TypeScript
  plugin itself; the bundles stay the same.
