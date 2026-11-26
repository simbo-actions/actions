---
'changelog': patch
---

Cover both tag types in the smoke tests of `signed-commit`.

- The first commit gets an annotated tag with `tag-message`; the test checks the
  tag object, the commit it points to, and its message.
- The tag on the head without a commit is lightweight and points to the commit.
