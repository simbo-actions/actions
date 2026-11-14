import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { countCommits, hasCommit, isShallowRepository, listRemoteBranches } from './git.js';

let root: string;
let origin: string;
let clone: string;

/**
 * Runs Git with a neutral configuration.
 *
 * @param cwd - The working directory.
 * @param args - The Git arguments.
 * @returns The trimmed standard output.
 */
function runGit(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' },
  ).trim();
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gitleaks-scan-'));
  origin = join(root, 'origin');
  clone = join(root, 'clone');
  runGit(root, 'init', '--quiet', '--initial-branch=main', origin);
  runGit(origin, 'commit', '--quiet', '--allow-empty', '-m', 'first');
  runGit(origin, 'switch', '--quiet', '--create', 'feature');
  runGit(origin, 'commit', '--quiet', '--allow-empty', '-m', 'second');
  runGit(origin, 'commit', '--quiet', '--allow-empty', '-m', 'third');
  runGit(root, 'clone', '--quiet', '--no-local', origin, clone);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('isShallowRepository', () => {
  it('detects a complete and a shallow clone', async () => {
    const shallow = join(root, 'shallow');
    runGit(root, 'clone', '--quiet', '--depth=1', `file://${origin}`, shallow);
    expect(await isShallowRepository(clone)).toBe(false);
    expect(await isShallowRepository(shallow)).toBe(true);
  });

  it('fails outside of a Git repository', async () => {
    await expect(isShallowRepository(tmpdir())).rejects.toThrow('is not a Git repository');
  });
});

describe('hasCommit', () => {
  it('finds existing commits only', async () => {
    expect(await hasCommit(clone, runGit(clone, 'rev-parse', 'HEAD'))).toBe(true);
    expect(await hasCommit(clone, '1'.repeat(40))).toBe(false);
  });
});

describe('countCommits', () => {
  it('counts the commits of a range', async () => {
    expect(await countCommits(clone, ['origin/main..origin/feature'])).toBe(2);
  });

  it('counts the commits that no other remote branch contains', async () => {
    const head = runGit(clone, 'rev-parse', 'origin/feature');
    expect(await countCommits(clone, [head, '--not', '--exclude=*/HEAD', '--exclude=*/feature', '--remotes'])).toBe(2);
  });

  it('fails for unknown revisions', async () => {
    await expect(countCommits(clone, ['unknown..HEAD'])).rejects.toThrow(
      'Git cannot list the commits of "unknown..HEAD".',
    );
  });
});

describe('listRemoteBranches', () => {
  it('lists the remote-tracking branches', async () => {
    expect(await listRemoteBranches(clone)).toEqual(['origin/HEAD', 'origin/feature', 'origin/main']);
  });
});
