import type { Stats } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, posix } from 'node:path';

import { warning } from '@actions/core';
import { getGitChanges } from '@simbo/git-changes';

import { existsInHead, getIndexMode, getRepositoryRoot, gitBuffer, gitSucceeds, listUntrackedFiles } from './git.js';
import {
  EXECUTABLE_PERMISSION_BITS,
  GIT_MODE_EXECUTABLE,
  GIT_MODE_SUBMODULE,
  GIT_MODE_SYMLINK,
} from './signed-commit-constants.js';
import type { DetectChangesOption, FileChanges, ParsedActionInputs } from './signed-commit.types.js';

/**
 * Inputs needed to collect the files to commit.
 */
type FilesToCommitInputs = Pick<
  ParsedActionInputs,
  'workingDirectory' | 'additionsList' | 'deletionsList' | 'detectChanges'
>;

/**
 * Collected additions (path to base64 contents) and deletions.
 */
interface Collection {
  workingDirectory: string;
  additions: Map<string, string>;
  deletions: Set<string>;
}

/**
 * Normalizes a path given as input to a repository path.
 *
 * @param path - The path relative to the working directory.
 * @returns The normalized path with forward slashes.
 * @throws {Error} if the path is absolute, empty, or points outside of the working directory.
 */
export function normalizeRepositoryPath(path: string): string {
  const normalized = posix.normalize(path.replaceAll('\\', '/')).replace(/^(\.\/)+/, '');
  if (normalized === '..' || normalized.startsWith('/') || normalized.startsWith('../') || isAbsolute(path)) {
    throw new Error(`Invalid path "${path}": paths must be relative to the working directory.`);
  }
  if (normalized === '.' || normalized === '') {
    throw new Error(`Invalid path "${path}": the path must point to a file.`);
  }
  return normalized;
}

/**
 * Encodes file contents as RFC 4648 base64 with padding, as required by `FileAddition.contents`.
 *
 * @param buffer - The file contents.
 * @returns The base64-encoded contents.
 */
function toBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Returns the file stats of a path without following symbolic links.
 *
 * @param path - The absolute path.
 * @returns The stats, or `undefined` if the path does not exist.
 */
async function lstatIfExists(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch {
    return;
  }
}

/**
 * Reads a file from the working directory and adds it to the additions.
 *
 * @param collection - The collection to add to.
 * @param path - The repository path.
 * @param explicit - Whether the path was given explicitly.
 * @throws {Error} if the path is missing, a symbolic link, or not a file.
 */
async function addWorkingTreeFile(collection: Collection, path: string, explicit: boolean): Promise<void> {
  const absPath = join(collection.workingDirectory, path);
  const stats = await lstatIfExists(absPath);
  if (!stats) {
    throw new Error(`File not found: ${path}`);
  }
  if (stats.isSymbolicLink()) {
    throw new Error(`Symbolic links are not supported: ${path}`);
  }
  if (!stats.isFile()) {
    throw new Error(explicit ? `Not a file: ${path}` : `Directories and submodules are not supported: ${path}`);
  }
  if (stats.mode & EXECUTABLE_PERMISSION_BITS) {
    warning(`The executable bit is not preserved: ${path}`);
  }
  collection.additions.set(path, toBase64(await readFile(absPath)));
}

/**
 * Adds the explicitly given additions and deletions.
 *
 * @param collection - The collection to add to.
 * @param additionsList - The paths to add.
 * @param deletionsList - The paths to delete.
 * @throws {Error} if a path is invalid or both added and deleted.
 */
async function addExplicitPaths(
  collection: Collection,
  additionsList: string[],
  deletionsList: string[],
): Promise<void> {
  const additionPaths = additionsList.map(path => normalizeRepositoryPath(path));
  const deletionPaths = deletionsList.map(path => normalizeRepositoryPath(path));

  for (const path of additionPaths) {
    await addWorkingTreeFile(collection, path, true);
  }
  for (const path of deletionPaths) {
    if (collection.additions.has(path)) {
      throw new Error(`A path must not be both added and deleted: ${path}`);
    }
    collection.deletions.add(path);
  }
}

/**
 * Ensures the working directory is the root of a Git repository.
 *
 * @param workingDirectory - The working directory.
 * @throws {Error} if the working directory is not the root of a Git repository.
 */
async function assertRepositoryRoot(workingDirectory: string): Promise<void> {
  const root = await getRepositoryRoot(workingDirectory);
  if (!root) {
    throw new Error(`Cannot detect changes: "${workingDirectory}" is not a Git repository.`);
  }
  if ((await realpath(root)) !== (await realpath(workingDirectory))) {
    throw new Error(`Cannot detect changes: "${workingDirectory}" must be the root of the Git repository.`);
  }
}

/**
 * Collects all paths affected by Git changes. Renames and copies contribute
 * both paths; their actual state is resolved separately, so the order in
 * which they are reported does not matter.
 *
 * @param workingDirectory - The root of the Git repository.
 * @param detectChanges - Which changes to detect.
 * @returns The affected paths, sorted.
 */
async function getCandidatePaths(workingDirectory: string, detectChanges: DetectChangesOption): Promise<string[]> {
  const candidates = new Set<string>();
  const changes = await getGitChanges(workingDirectory);
  for (const change of changes.values()) {
    if (detectChanges === 'staged' && !change.staged) {
      continue;
    }
    candidates.add(change.path);
    if (change.originPath) {
      candidates.add(change.originPath);
    }
  }
  return [...candidates].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Resolves a changed path against the working tree.
 *
 * @param collection - The collection to add to.
 * @param path - The repository path.
 * @param skip - Paths to ignore (given explicitly).
 */
async function resolveWorkingTreePath(collection: Collection, path: string, skip: Set<string>): Promise<void> {
  const root = collection.workingDirectory;

  if (path.endsWith('/')) {
    // untracked directory: add all untracked, not ignored files below it
    const files = await listUntrackedFiles(root, path);
    for (const file of files) {
      if (!skip.has(file)) {
        await addWorkingTreeFile(collection, file, false);
      }
    }
    return;
  }

  const exists = (await lstatIfExists(join(root, path))) !== undefined;
  const inHead = await existsInHead(root, path);

  if (!exists) {
    if (inHead) {
      collection.deletions.add(path);
    }
    return;
  }

  // unchanged, for example the source of a copy
  if (inHead && (await gitSucceeds(root, ['diff', '--quiet', 'HEAD', '--', `:(literal)${path}`]))) {
    return;
  }

  await addWorkingTreeFile(collection, path, false);
}

/**
 * Resolves a changed path against the index.
 *
 * @param collection - The collection to add to.
 * @param path - The repository path.
 * @throws {Error} if the path is a symbolic link or a submodule.
 */
async function resolveIndexPath(collection: Collection, path: string): Promise<void> {
  const root = collection.workingDirectory;
  const mode = await getIndexMode(root, path);
  const inHead = await existsInHead(root, path);

  if (!mode) {
    if (inHead) {
      collection.deletions.add(path);
    }
    return;
  }
  if (mode === GIT_MODE_SYMLINK) {
    throw new Error(`Symbolic links are not supported: ${path}`);
  }
  if (mode === GIT_MODE_SUBMODULE) {
    throw new Error(`Directories and submodules are not supported: ${path}`);
  }

  // unchanged, for example the source of a copy
  if (inHead && (await gitSucceeds(root, ['diff', '--quiet', '--cached', '--', `:(literal)${path}`]))) {
    return;
  }

  if (mode === GIT_MODE_EXECUTABLE) {
    warning(`The executable bit is not preserved: ${path}`);
  }
  collection.additions.set(path, toBase64(await gitBuffer(root, ['cat-file', 'blob', `:${path}`])));
}

/**
 * Collects the files to commit from the explicit inputs and the detected Git changes.
 *
 * Explicit additions and deletions take precedence over detected changes.
 * Detected changes reflect the working tree (`all`) or the index (`staged`).
 *
 * @param inputs - The relevant action inputs.
 * @returns The file additions and deletions, sorted by path.
 * @throws {Error} if a file is missing, a symbolic link, or a submodule, or if the
 * working directory is not the root of a Git repository when detecting changes.
 */
export async function getFilesToCommit(inputs: FilesToCommitInputs): Promise<FileChanges> {
  const { workingDirectory, additionsList, deletionsList, detectChanges } = inputs;
  const collection: Collection = { workingDirectory, additions: new Map(), deletions: new Set() };

  await addExplicitPaths(collection, additionsList, deletionsList);

  if (detectChanges !== 'none') {
    await assertRepositoryRoot(workingDirectory);
    const explicitPaths = new Set(collection.deletions);
    for (const path of collection.additions.keys()) {
      explicitPaths.add(path);
    }
    const candidates = await getCandidatePaths(workingDirectory, detectChanges);
    for (const path of candidates) {
      if (explicitPaths.has(path)) {
        continue;
      }
      await (detectChanges === 'all'
        ? resolveWorkingTreePath(collection, path, explicitPaths)
        : resolveIndexPath(collection, path));
    }
  }

  const additionPaths = [...collection.additions.keys()].toSorted((a, b) => a.localeCompare(b));
  const deletionPaths = [...collection.deletions].toSorted((a, b) => a.localeCompare(b));

  return {
    additions: additionPaths.map(path => ({ path, contents: collection.additions.get(path) ?? '' })),
    deletions: deletionPaths.map(path => ({ path })),
  };
}
