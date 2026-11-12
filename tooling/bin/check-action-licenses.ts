//------------------------------------------------------------------------------
// Check Action Licenses
//
// Fails if an action has no LICENSE.md with a copyright year, or if its README
// links the license with another year.
// Usage: node tooling/bin/check-action-licenses.ts (from the repository root)
//------------------------------------------------------------------------------

import { exit, stderr, stdout } from 'node:process';

import { checkActionLicenses } from '../src/action-licenses.ts';

const problems = await checkActionLicenses('actions');

if (problems.length > 0) {
  for (const problem of problems) {
    stderr.write(`✖ ${problem}\n`);
  }
  exit(1);
}

stdout.write('✔ All actions have a LICENSE.md, linked with the same year in their README.\n');
