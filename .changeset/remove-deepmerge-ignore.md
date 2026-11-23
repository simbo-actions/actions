---
'changelog': patch
---

Remove the unused osv-scanner ignore for `deepmerge` (`GHSA-gcqx-w48m-w2h4`).

- osv-scanner no longer reports the advisory for the locked version, so the
  entry in `osv-scanner.toml` had no effect.
