---
'staged-release': patch
---

Upload assets without an explicit `content-length` header; the GitHub client
sets it from the data, and setting it as well failed every upload with "invalid
content-length header".
