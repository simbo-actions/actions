//------------------------------------------------------------------------------
// Create Dependency Changeset
//
// After a merged Dependabot update of npm dependencies, writes patch
// changesets as described in DEVELOPMENT.md: one for the actions whose bundled
// (production) dependencies changed, compared in the lockfile of the commit
// and its parent, and one for the package "changelog" for all other updated
// dependencies, such as development dependencies. Sets the step output
// "created".
// Usage: node tooling/bin/create-dependency-changeset.ts <commit sha>
//------------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, env, stdout } from 'node:process';

import {
  diffDependencies,
  flattenDependencies,
  formatDependencyChangeset,
  getAffectedActions,
  mergeUpdates,
  type DependencyTree,
  type DependencyUpdate,
  type PackageDependencies,
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

/**
 * Reads the dependencies of a workspace.
 *
 * @param directory - The root of a checkout.
 * @param workspace - The workspace folder, relative to the root.
 * @returns The dependencies; empty if the workspace does not exist there.
 */
async function readDependencies(directory: string, workspace: string): Promise<PackageDependencies> {
  const content = await readFile(join(directory, workspace, 'package.json'), 'utf8').catch(() => '{}');
  return JSON.parse(content) as PackageDependencies;
}

const sha = argv[2] ?? 'HEAD';
const short = sha.slice(0, SHORT_SHA_LENGTH);
const entries = await readdir('actions', { withFileTypes: true });
const actions = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
const workspaces = ['.', 'changelog', 'tooling', ...actions.map(name => join('actions', name))];

const previous = await mkdtemp(join(tmpdir(), 'dependency-changeset-'));
let affected: string[];
const bundledUpdates: Record<string, DependencyUpdate[]> = {};
const otherUpdates: DependencyUpdate[][] = [];
try {
  execFileSync('git', ['worktree', 'add', '--detach', previous, `${sha}~1`], { stdio: 'ignore' });
  affected = getAffectedActions(listProductionPackages(previous, actions), listProductionPackages('.', actions));
  for (const workspace of workspaces) {
    const before = await readDependencies(previous, workspace);
    const after = await readDependencies('.', workspace);
    const production = diffDependencies(before.dependencies, after.dependencies);
    if (workspace.startsWith('actions/')) {
      bundledUpdates[workspace.slice('actions/'.length)] = production;
    } else {
      otherUpdates.push(production);
    }
    otherUpdates.push(diffDependencies(before.devDependencies, after.devDependencies));
  }
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', previous], { stdio: 'ignore' });
  await rm(previous, { recursive: true, force: true });
}

const files: string[] = [];
if (affected.length > 0) {
  const updates = mergeUpdates(...affected.map(name => bundledUpdates[name] ?? []));
  const file = join('.changeset', `update-dependencies-${short}.md`);
  await writeFile(file, formatDependencyChangeset(affected, updates, 'Update dependencies.'));
  files.push(file);
  stdout.write(`✔ Created ${file} for: ${affected.join(', ')}\n`);
}
const development = mergeUpdates(...otherUpdates);
if (development.length > 0) {
  const file = join('.changeset', `update-development-dependencies-${short}.md`);
  await writeFile(file, formatDependencyChangeset(['changelog'], development, 'Update development dependencies.'));
  files.push(file);
  stdout.write(`✔ Created ${file} for: changelog\n`);
}
if (files.length === 0) {
  stdout.write('✔ No dependency changed; no changeset needed.\n');
}

if (env.GITHUB_OUTPUT) {
  await appendFile(env.GITHUB_OUTPUT, `created=${String(files.length > 0)}\n`);
}
