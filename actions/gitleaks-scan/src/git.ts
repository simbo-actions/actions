import { getExecOutput } from '@actions/exec';

/**
 * Runs a Git command silently.
 *
 * @param cwd - The repository.
 * @param args - The Git arguments.
 * @returns The exit code and the trimmed standard output.
 */
async function git(cwd: string, args: string[]): Promise<{ exitCode: number; stdout: string }> {
  const { exitCode, stdout } = await getExecOutput('git', args, { cwd, silent: true, ignoreReturnCode: true });
  return { exitCode, stdout: stdout.trim() };
}

/**
 * Checks whether a Git repository is a shallow clone.
 *
 * @param cwd - The repository.
 * @returns `true` if the repository is shallow.
 * @throws {Error} if the directory is not a Git repository.
 */
export async function isShallowRepository(cwd: string): Promise<boolean> {
  const { exitCode, stdout } = await git(cwd, ['rev-parse', '--is-shallow-repository']);
  if (exitCode !== 0) {
    throw new Error(`"${cwd}" is not a Git repository. Check it out first, or use the scope "files".`);
  }
  return stdout === 'true';
}

/**
 * Checks whether a commit exists in the repository.
 *
 * @param cwd - The repository.
 * @param sha - The commit SHA.
 * @returns `true` if the commit exists.
 */
export async function hasCommit(cwd: string, sha: string): Promise<boolean> {
  const { exitCode, stdout } = await git(cwd, ['cat-file', '-t', sha]);
  return exitCode === 0 && stdout === 'commit';
}

/**
 * Counts the commits that `git log` selects with the given options.
 *
 * @param cwd - The repository.
 * @param revisions - Revisions and options for `git rev-list`.
 * @returns The number of commits.
 * @throws {Error} if Git cannot resolve the revisions.
 */
export async function countCommits(cwd: string, revisions: string[]): Promise<number> {
  const { exitCode, stdout } = await git(cwd, ['rev-list', '--count', ...revisions]);
  if (exitCode !== 0) {
    throw new Error(`Git cannot list the commits of "${revisions.join(' ')}".`);
  }
  return Number(stdout);
}

/**
 * Lists the remote-tracking branches, without `refs/remotes/`.
 *
 * @param cwd - The repository.
 * @returns The branch names, for example `origin/main`.
 */
export async function listRemoteBranches(cwd: string): Promise<string[]> {
  const { stdout } = await git(cwd, ['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/remotes']);
  return stdout.split('\n').filter(Boolean);
}
