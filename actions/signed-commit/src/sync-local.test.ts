import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { warning } from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cloneGitFixture, createGitFixture, createTempDir, type GitFixture } from '../tests/git-fixture.js';

import { syncLocal } from './sync-local.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

describe('syncLocal', () => {
  let origin: GitFixture;
  let local: GitFixture;
  let other: GitFixture;
  let parentOid: string;
  let commitOid: string;

  beforeEach(async () => {
    // origin with one commit, a local clone, and a commit created elsewhere (like the API does)
    const seed = await createGitFixture({ 'file.txt': 'v1' });
    origin = await cloneGitFixture(seed.dir, '--bare');
    await seed.cleanup();

    local = await cloneGitFixture(origin.dir);
    parentOid = local.git('rev-parse', 'HEAD');

    other = await cloneGitFixture(origin.dir);
    other.git('commit', '--quiet', '--allow-empty', '-m', 'api commit');
    other.git('push', '--quiet', 'origin', 'HEAD:main');
    commitOid = other.git('rev-parse', 'HEAD');

    vi.mocked(warning).mockClear();
  });

  afterEach(async () => {
    await Promise.all([origin, local, other].map(async fixture => fixture.cleanup()));
  });

  it('moves HEAD to the new commit and keeps the working tree', async () => {
    await local.write('file.txt', 'local change');
    local.git('add', 'file.txt');

    expect(
      await syncLocal({ workingDirectory: local.dir, branch: 'main', parentOid, commitOid, tags: ['v1.0.0'] }),
    ).toBe(true);

    expect(local.git('rev-parse', 'HEAD')).toBe(commitOid);
    expect(local.git('rev-parse', 'refs/remotes/origin/main')).toBe(commitOid);
    expect(local.git('rev-parse', 'refs/tags/v1.0.0')).toBe(commitOid);
    expect(await readFile(join(local.dir, 'file.txt'), 'utf8')).toBe('local change');
    expect(local.git('diff', '--cached', '--name-only')).toBe('');
  });

  it('switches to a new branch without moving the local base branch', async () => {
    other.git('push', '--quiet', 'origin', 'HEAD:feature');
    await local.write('file.txt', 'local change');

    expect(
      await syncLocal({
        workingDirectory: local.dir,
        branch: 'feature',
        parentOid,
        commitOid,
        tags: [],
        switchBranch: true,
      }),
    ).toBe(true);

    expect(local.git('symbolic-ref', '--short', 'HEAD')).toBe('feature');
    expect(local.git('rev-parse', 'HEAD')).toBe(commitOid);
    expect(local.git('rev-parse', 'refs/heads/main')).toBe(parentOid);
    expect(await readFile(join(local.dir, 'file.txt'), 'utf8')).toBe('local change');
  });

  it('keeps existing local tags', async () => {
    local.git('tag', 'v1.0.0', parentOid);
    await syncLocal({ workingDirectory: local.dir, branch: 'main', parentOid, commitOid, tags: ['v1.0.0'] });
    expect(local.git('rev-parse', 'refs/tags/v1.0.0')).toBe(parentOid);
  });

  it('skips outside of a Git repository', async () => {
    const dir = await createTempDir();
    expect(await syncLocal({ workingDirectory: dir, branch: 'main', parentOid, commitOid, tags: [] })).toBe(false);
  });

  it('skips if HEAD is not the parent', async () => {
    expect(
      await syncLocal({ workingDirectory: local.dir, branch: 'main', parentOid: commitOid, commitOid, tags: [] }),
    ).toBe(false);
    expect(local.git('rev-parse', 'HEAD')).toBe(parentOid);
  });

  it('warns if the commit cannot be fetched', async () => {
    expect(
      await syncLocal({ workingDirectory: local.dir, branch: 'main', parentOid, commitOid: 'f'.repeat(40), tags: [] }),
    ).toBe(false);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Failed to sync the local checkout'));
    expect(local.git('rev-parse', 'HEAD')).toBe(parentOid);
  });

  it('warns if fetching fails', async () => {
    local.git('remote', 'remove', 'origin');
    expect(await syncLocal({ workingDirectory: local.dir, branch: 'main', parentOid, commitOid, tags: [] })).toBe(
      false,
    );
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Failed to sync the local checkout'));
  });
});
