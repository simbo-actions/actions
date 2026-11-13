//------------------------------------------------------------------------------
// Check Actions
//
// Fails if an action has no LICENSE.md with a copyright year, if its README
// links the license with another year, misses a required section, or misses
// the note about the monorepo.
// Usage: node tooling/bin/check-actions.ts (from the repository root)
//------------------------------------------------------------------------------

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exit, stderr, stdout } from 'node:process';

import { checkActionLicenses } from '../src/action-licenses.ts';
import { checkActionReadme } from '../src/action-readmes.ts';

const problems = await checkActionLicenses('actions');

const entries = await readdir('actions', { withFileTypes: true });
const directories = entries.filter(item => item.isDirectory());
for (const entry of directories) {
  const readme = await readFile(join('actions', entry.name, 'README.md'), 'utf8').catch(() => '');
  problems.push(...checkActionReadme(entry.name, readme));
}

if (problems.length > 0) {
  for (const problem of problems) {
    stderr.write(`✖ ${problem}\n`);
  }
  exit(1);
}

stdout.write('✔ All actions have a LICENSE.md, a matching license link, all README sections, and the monorepo note.\n');
