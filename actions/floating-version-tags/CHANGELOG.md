# floating-version-tags

## 1.0.1

### Patch Changes

- 5ceca79: Replace an annotated floating tag whose message names another
  release, for example when two release tags point to the same commit, instead
  of keeping it.

## 1.0.0

### Major Changes

- b435496: Initial release: move floating version tags like `v1` forward to a
  release, only to the highest stable version of their line, never to
  prereleases. Supports prefixed tags like `my-package/v1.2.3`, versions without
  `v`, annotated tags with a message, the tag of the workflow as default, and a
  job summary.
