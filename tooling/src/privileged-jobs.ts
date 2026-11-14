/**
 * Actions and commands that install or run npm code.
 */
const NPM_CODE = [
  /\buses:\s*actions\/setup-node@/,
  /\buses:\s*pnpm\/action-setup@/,
  /(?:^|[\s"'(;&|])(?:pnpm|npm|npx|node|yarn|corepack)(?:\s|$)/,
];

/**
 * A local action, built from this repository in the same run.
 */
const LOCAL_ACTION = /\buses:\s*\.\//;

/**
 * The environment `release`, as short form or as `name` of the environment.
 */
const RELEASE_ENVIRONMENT = /^(?: {4}environment| {6}name):\s*release\s*$/;

/**
 * Splits the jobs of a workflow into blocks of lines, by job ID.
 *
 * Relies on the formatting of this repository: `jobs:` at the top level and job
 * IDs indented by two spaces.
 *
 * @param workflow - The workflow file.
 * @returns The lines of every job, by job ID.
 */
export function getJobs(workflow: string): Record<string, string[]> {
  const lines = workflow.split('\n');
  const start = lines.indexOf('jobs:');
  const jobs: Record<string, string[]> = {};
  let current: string[] | undefined;
  const jobLines = lines.slice(start + 1);
  for (const line of jobLines) {
    if (start === -1 || /^\S/.test(line)) {
      break;
    }
    const id = /^ {2}([\w-]+):\s*$/.exec(line)?.[1];
    if (id === undefined) {
      current?.push(line);
    } else {
      current = [];
      jobs[id] = current;
    }
  }
  return jobs;
}

/**
 * Checks that jobs with an environment run no npm code: no Node.js or pnpm
 * setup and no npm, pnpm, or node commands. Jobs with the environment
 * `release` also run no local actions, only published ones. Comments are
 * ignored.
 *
 * @param path - The workflow path, for the problem message.
 * @param workflow - The workflow file.
 * @returns The problems found, empty if all privileged jobs comply.
 */
export function checkPrivilegedJobs(path: string, workflow: string): string[] {
  const problems: string[] = [];
  const jobs = Object.entries(getJobs(workflow));
  for (const [id, lines] of jobs) {
    if (lines.every(line => !/^ {4}environment:/.test(line))) {
      continue;
    }
    const code = lines.filter(line => !line.trimStart().startsWith('#'));
    const offending = code.find(line => NPM_CODE.some(pattern => pattern.test(line)));
    if (offending !== undefined) {
      problems.push(`${path}: job "${id}" has an environment but runs npm code: ${offending.trim()}`);
    }
    // The integration tests run local actions on purpose, with a key that only
    // reaches the sandbox; the release key is used only with published actions.
    const local = code.find(line => LOCAL_ACTION.test(line));
    if (local !== undefined && code.some(line => RELEASE_ENVIRONMENT.test(line))) {
      problems.push(
        `${path}: job "${id}" has an environment but runs a local action; use the published action, pinned by SHA: ${local.trim()}`,
      );
    }
  }
  return problems;
}
