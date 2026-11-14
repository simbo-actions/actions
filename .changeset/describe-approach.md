---
'changelog': patch
---

Describe the approach of Simbo's Actions in the organization profile, the
README, and the architecture.

- A section "How It Works" in the organization profile and the README explains
  the constraints of GitHub Actions and how the monorepo separates source from
  distribution.
- The architecture starts with "Approach" instead of "Why".
- The section "About Simbo's Actions" of every action README comes from
  `tooling/about-section.md` and is checked by `check:actions`.
