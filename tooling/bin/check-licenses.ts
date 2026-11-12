//------------------------------------------------------------------------------
// Check Licenses
//
// Fails if a production dependency has a license that is not allowed.
// Usage: node tooling/bin/check-licenses.ts (from the repository root)
//------------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { exit, stderr, stdout } from 'node:process';

import { ALLOWED_LICENSES } from '../src/constants.ts';
import { findLicenseViolations, type LicenseList } from '../src/licenses.ts';

const output = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], { encoding: 'utf8' });
const violations = findLicenseViolations(JSON.parse(output) as LicenseList, ALLOWED_LICENSES);

if (violations.length > 0) {
  for (const { name, versions, license } of violations) {
    stderr.write(`✖ ${name}@${versions.join(', ')}: ${license}\n`);
  }
  stderr.write(`\nAllowed licenses: ${ALLOWED_LICENSES.join(', ')}\n`);
  exit(1);
}

stdout.write(`✔ All production dependencies use allowed licenses (${ALLOWED_LICENSES.join(', ')}).\n`);
