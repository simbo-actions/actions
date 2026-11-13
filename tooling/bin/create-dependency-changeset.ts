//------------------------------------------------------------------------------
// Create Dependency Changeset
//
// After a merged Dependabot update of npm dependencies, writes a patch
// changeset for the actions whose bundled (production) dependencies changed,
// and sets the step output "created". Development dependencies cause no
// release. Compares the lockfile of the commit with that of its parent.
// Usage: node tooling/bin/create-dependency-changeset.ts <commit sha>
//------------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, env, stdout } from 'node:process';

import {
  flattenDependencies,
  formatDependencyChangeset,
  getAffectedActions,
  type DependencyTree,
} from '../src/dependency-changeset.ts';

const SHORT_SHA_LENGTH = 7;

/**
 * Lists the production packages of every action from the lockfile.
 *
 * @param directory - The root of a checkout.
 * @param names - The action folder names, which are also the package names.
 * @returns The packages of every action, by name.
 */
function listProductionPackages(directory: string, names: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const name of names) {
    const output = execFileSync(
      'pnpm',
      ['list', '--filter', name, '--lockfile-only', '--prod', '--json', '--depth', 'Infinity'],
      { cwd: directory, encoding: 'utf8' },
    );
    const projects = JSON.parse(output) as { name: string; dependencies?: DependencyTree }[];
    const project = projects.find(item => item.name === name);
    if (project) {
      result[name] = flattenDependencies(project.dependencies);
    }
  }
  return result;
}

const sha = argv[2] ?? 'HEAD';
const entries = await readdir('actions', { withFileTypes: true });
const actions = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

const previous = await mkdtemp(join(tmpdir(), 'dependency-changeset-'));
let affected: string[];
try {
  execFileSync('git', ['worktree', 'add', '--detach', previous, `${sha}~1`], { stdio: 'ignore' });
  affected = getAffectedActions(listProductionPackages(previous, actions), listProductionPackages('.', actions));
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', previous], { stdio: 'ignore' });
  await rm(previous, { recursive: true, force: true });
}

if (affected.length > 0) {
  const file = join('.changeset', `dependency-updates-${sha.slice(0, SHORT_SHA_LENGTH)}.md`);
  await writeFile(file, formatDependencyChangeset(affected));
  stdout.write(`✔ Created ${file} for: ${affected.join(', ')}\n`);
} else {
  stdout.write('✔ No bundled dependency of an action changed; no changeset needed.\n');
}

if (env.GITHUB_OUTPUT) {
  await appendFile(env.GITHUB_OUTPUT, `created=${String(affected.length > 0)}\n`);
}
