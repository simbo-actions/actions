---
'changelog': patch
---

Describe the behavior of the Marketplace form in the runbook "Marketplace
Listing".

- Listing works for immutable releases; saving a release that is still mutable
  makes it immutable.
- The form requires a description of fewer than 125 characters, which
  `check:actions` ensures.
- If the form reports errors without showing any, save again.
