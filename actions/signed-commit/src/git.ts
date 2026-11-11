import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { GIT_MAX_BUFFER_BYTES } from './signed-commit-constants.js';

const execFileAsync = promisify(execFile);

/**
 * Runs a Git command and returns its raw output.
 *
 * @param cwd - The working directory.
 * @param args - The Git arguments.
 * @returns The standard output as buffer.
 * @throws {Error} if the command fails.
 */
export async function gitBuffer(cwd: string, args: string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'buffer', maxBuffer: GIT_MAX_BUFFER_BYTES });
  return stdout;
}

/**
 * Runs a Git command and returns its trimmed output.
 *
 * @param cwd - The working directory.
 * @param args - The Git arguments.
 * @returns The standard output as trimmed string.
 * @throws {Error} if the command fails.
 */
export async function git(cwd: string, args: string[]): Promise<string> {
  return (await gitBuffer(cwd, args)).toString('utf8').trim();
}

/**
 * Runs a Git command and reports whether it succeeded.
 *
 * @param cwd - The working directory.
 * @param args - The Git arguments.
 * @returns `true` if the command exited with code 0.
 */
export async function gitSucceeds(cwd: string, args: string[]): Promise<boolean> {
  try {
    await gitBuffer(cwd, args);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the root of the Git working tree that contains the directory.
 *
 * @param cwd - The directory.
 * @returns The absolute path of the working tree root, or `undefined` outside of a Git repository.
 */
export async function getRepositoryRoot(cwd: string): Promise<string | undefined> {
  try {
    return await git(cwd, ['rev-parse', '--show-toplevel']);
  } catch {
    return undefined;
  }
}

/**
 * Returns the object ID of `HEAD`.
 *
 * @param cwd - The directory of the Git repository.
 * @returns The object ID, or `undefined` if the repository has no commits.
 */
export async function getHeadOid(cwd: string): Promise<string | undefined> {
  try {
    return await git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
  } catch {
    return undefined;
  }
}

/**
 * Returns the index entry (mode) of a path.
 *
 * @param cwd - The directory of the Git repository.
 * @param path - The path relative to the repository root.
 * @returns The file mode, or `undefined` if the path is not in the index.
 */
export async function getIndexMode(cwd: string, path: string): Promise<string | undefined> {
  const output = await git(cwd, ['ls-files', '--stage', '--', `:(literal)${path}`]);
  return output ? output.split(' ', 1)[0] : undefined;
}

/**
 * Checks whether a path exists in the tree of `HEAD`.
 *
 * @param cwd - The directory of the Git repository.
 * @param path - The path relative to the repository root.
 * @returns `true` if the path exists in `HEAD`.
 */
export async function existsInHead(cwd: string, path: string): Promise<boolean> {
  return gitSucceeds(cwd, ['cat-file', '-e', `HEAD:${path}`]);
}
