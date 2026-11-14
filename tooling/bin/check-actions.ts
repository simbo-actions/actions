//------------------------------------------------------------------------------
// Check Actions
//
// Fails if an action has no LICENSE.md with a copyright year, if its README
// links the license with another year, misses a required section, or misses
// the note about the monorepo, if the copies of the Octokit client in the
// actions differ, if a workflow scans with other allowed licenses than the
// script "check:vulnerabilities", or if a job with an environment (and thereby
// secrets) runs npm code, or a job with the environment "release" runs a local
// action.
// Usage: node tooling/bin/check-actions.ts (from the repository root)
//------------------------------------------------------------------------------

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exit, stderr, stdout } from 'node:process';

import { checkActionLicenses } from '../src/action-licenses.ts';
import { checkActionReadme } from '../src/action-readmes.ts';
import { checkIdenticalCopies } from '../src/identical-copies.ts';
import { checkPrivilegedJobs } from '../src/privileged-jobs.ts';
import { checkVulnerabilityLicenses } from '../src/vulnerability-licenses.ts';

const problems = await checkActionLicenses('actions');

const entries = await readdir('actions', { withFileTypes: true });
const directories = entries.filter(item => item.isDirectory());
for (const entry of directories) {
  const readme = await readFile(join('actions', entry.name, 'README.md'), 'utf8').catch(() => '');
  problems.push(...checkActionReadme(entry.name, readme));
}

const octokitClients: Record<string, string> = {};
for (const entry of directories) {
  const path = join('actions', entry.name, 'src', 'create-octokit.ts');
  const content = await readFile(path, 'utf8').catch(() => '');
  if (content !== '') {
    octokitClients[path] = content;
  }
}
problems.push(...checkIdenticalCopies('create-octokit.ts', octokitClients));

const packageJson = await readFile('package.json', 'utf8');
const { scripts } = JSON.parse(packageJson) as { scripts: Record<string, string | undefined> };
const workflowDirectory = join('.github', 'workflows');
const workflowNames = await readdir(workflowDirectory);
const workflows: Record<string, string> = {};
for (const name of workflowNames) {
  workflows[join(workflowDirectory, name)] = await readFile(join(workflowDirectory, name), 'utf8');
}
problems.push(...checkVulnerabilityLicenses(scripts['check:vulnerabilities'] ?? '', workflows));
for (const [path, content] of Object.entries(workflows)) {
  problems.push(...checkPrivilegedJobs(path, content));
}

if (problems.length > 0) {
  for (const problem of problems) {
    stderr.write(`✖ ${problem}\n`);
  }
  exit(1);
}

stdout.write(
  '✔ All actions have a LICENSE.md, a matching license link, all README sections, and the monorepo note; all Octokit clients are identical; all workflows scan with the same allowed licenses; no job with an environment runs npm code, and the release runs only published actions.\n',
);
