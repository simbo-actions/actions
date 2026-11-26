---
'signed-commit': major
---

Create annotated tags by default.

- The input `tag-type` selects `annotated` (default) or `lightweight` tags.
- An annotated tag has the identity of the token as tagger and the message
  `tag-message`, by default the tag name; `{tag}` in `tag-message` is replaced
  with the tag name, for example `Release {tag}`.
- An existing tag is accepted only if it points to the same commit and has the
  requested type.
- With `sync`, annotated tags are fetched from `origin` instead of being created
  locally.
- The rate limit warning counts two requests per annotated tag.
- The README explains why tags are not signed: GitHub does not sign tag objects
  created via the API.

Tags are now annotated tag objects instead of lightweight tags. Set
`tag-type: lightweight` to keep lightweight tags. A re-run of an earlier run
fails if its lightweight tags exist while annotated tags are requested; set
`tag-type: lightweight` for it, or delete the tags first.
