//------------------------------------------------------------------------------
// Check Actions
//
// Fails if an action has no single-line description in action.yml of at most
// 124 characters (the limit of the GitHub Marketplace), repeated in its
// package.json and as the first paragraph of its README, if it has no
// LICENSE.md with a copyright year, if its README links the license with
// another year, misses a required section, or has a section about the
// organization that differs from tooling/about-section.md,
// if the copies of the Octokit client in the actions differ, if a workflow
// scans with other allowed licenses than the script "check:vulnerabilities", or
// if a job with an environment (and thereby secrets) runs npm code, or a job
// with the environment "release" runs a local action.
// Usage: node tooling/bin/check-actions.ts (from the repository root)
//------------------------------------------------------------------------------

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exit, stderr, stdout } from 'node:process';

import { checkActionDescription } from '../src/action-descriptions.ts';
import { checkActionLicenses } from '../src/action-licenses.ts';
import { checkActionReadme } from '../src/action-readmes.ts';
import { checkIdenticalCopies } from '../src/identical-copies.ts';
import { checkPrivilegedJobs } from '../src/privileged-jobs.ts';
import { checkVulnerabilityLicenses } from '../src/vulnerability-licenses.ts';

const problems = await checkActionLicenses('actions');

const aboutSection = await readFile(join('tooling', 'about-section.md'), 'utf8');
const entries = await readdir('actions', { withFileTypes: true });
const directories = entries.filter(item => item.isDirectory());
const actionFiles = await Promise.all(
  directories.map(async ({ name }) => {
    const [readme, actionYml, actionPackage, octokitClient] = await Promise.all([
      readFile(join('actions', name, 'README.md'), 'utf8').catch(() => ''),
      readFile(join('actions', name, 'action.yml'), 'utf8').catch(() => ''),
      readFile(join('actions', name, 'package.json'), 'utf8').catch(() => '{}'),
      readFile(join('actions', name, 'src', 'create-octokit.ts'), 'utf8').catch(() => ''),
    ]);
    return { name, readme, actionYml, actionPackage, octokitClient };
  }),
);
for (const { name, readme, actionYml, actionPackage } of actionFiles) {
  problems.push(...checkActionReadme(name, readme, aboutSection));
  const { description } = JSON.parse(actionPackage) as { description?: string };
  problems.push(...checkActionDescription(name, actionYml, description, readme));
}

const octokitClients: Record<string, string> = {};
for (const { name, octokitClient } of actionFiles) {
  if (octokitClient !== '') {
    octokitClients[join('actions', name, 'src', 'create-octokit.ts')] = octokitClient;
  }
}
problems.push(...checkIdenticalCopies('create-octokit.ts', octokitClients));

const packageJson = await readFile('package.json', 'utf8');
const { scripts } = JSON.parse(packageJson) as { scripts: Record<string, string | undefined> };
const workflowDirectory = join('.github', 'workflows');
const workflowNames = await readdir(workflowDirectory);
const workflows: Record<string, string> = Object.fromEntries(
  await Promise.all(
    workflowNames.map(async name => {
      const path = join(workflowDirectory, name);
      return [path, await readFile(path, 'utf8')] as const;
    }),
  ),
);
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
  '✔ All actions have a description that fits the Marketplace and matches package.json and the README, a LICENSE.md, a matching license link, all README sections, and the section about the organization; all Octokit clients are identical; all workflows scan with the same allowed licenses; no job with an environment runs npm code, and the release runs only published actions.\n',
);
