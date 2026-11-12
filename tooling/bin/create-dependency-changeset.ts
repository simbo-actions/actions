//------------------------------------------------------------------------------
// Create Dependency Changeset
//
// After a merged Dependabot update of npm dependencies, writes a patch
// changeset for the affected actions and sets the step output "created".
// Usage: node tooling/bin/create-dependency-changeset.ts <commit sha>
//------------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { appendFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, env, stdout } from 'node:process';

import { formatDependencyChangeset, getAffectedActions } from '../src/dependency-changeset.ts';

/**
 * Length of the abbreviated commit SHA in the changeset file name.
 */
const SHORT_SHA_LENGTH = 7;

const sha = argv[2] ?? 'HEAD';
const changedFiles = execFileSync('git', ['diff', '--name-only', `${sha}~1`, sha], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const entries = await readdir('actions', { withFileTypes: true });
const actionFolders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
const affected = getAffectedActions(changedFiles, actionFolders);

const packageNames = await Promise.all(
  affected.map(async folder => {
    const packageJson = JSON.parse(await readFile(join('actions', folder, 'package.json'), 'utf8')) as { name: string };
    return packageJson.name;
  }),
);

if (packageNames.length > 0) {
  const file = join('.changeset', `dependency-updates-${sha.slice(0, SHORT_SHA_LENGTH)}.md`);
  await writeFile(file, formatDependencyChangeset(packageNames));
  stdout.write(`✔ Created ${file} for: ${packageNames.join(', ')}\n`);
} else {
  stdout.write('✔ No action is affected; no changeset needed.\n');
}

if (env.GITHUB_OUTPUT) {
  await appendFile(env.GITHUB_OUTPUT, `created=${String(packageNames.length > 0)}\n`);
}
