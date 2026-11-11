import { chmod, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { warning } from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGitFixture, createTempDir, type GitFixture } from '../tests/git-fixture.js';

import { getFilesToCommit, normalizeRepositoryPath } from './get-files-to-commit.js';
import type { DetectChangesOption } from './signed-commit.types.js';

vi.mock('@actions/core', () => ({ warning: vi.fn() }));

/**
 * Decodes base64 contents.
 *
 * @param contents - The base64 contents.
 * @returns The decoded string.
 */
function decode(contents: string): string {
  return Buffer.from(contents, 'base64').toString('utf8');
}

/**
 * Collects the files with the given options and returns paths and decoded contents.
 *
 * @param fixture - The Git fixture.
 * @param detectChanges - Which changes to detect.
 * @param lists - Explicit additions and deletions.
 * @param lists.additionsList - Explicit additions.
 * @param lists.deletionsList - Explicit deletions.
 * @returns The additions as path-to-contents record and the deleted paths.
 */
async function collect(
  fixture: GitFixture,
  detectChanges: DetectChangesOption,
  lists: { additionsList?: string[]; deletionsList?: string[] } = {},
): Promise<{ additions: Record<string, string>; deletions: string[] }> {
  const { additions, deletions } = await getFilesToCommit({
    workingDirectory: fixture.dir,
    additionsList: lists.additionsList ?? [],
    deletionsList: lists.deletionsList ?? [],
    detectChanges,
  });
  return {
    additions: Object.fromEntries(additions.map(({ path, contents }) => [path, decode(contents)])),
    deletions: deletions.map(({ path }) => path),
  };
}

describe('normalizeRepositoryPath', () => {
  it('normalizes relative paths', () => {
    expect(normalizeRepositoryPath('./a/../b/c.txt')).toBe('b/c.txt');
    expect(normalizeRepositoryPath(String.raw`dir\file.txt`)).toBe('dir/file.txt');
  });

  it.each(['/etc/passwd', '../outside.txt', '..', '.', ''])('rejects "%s"', path => {
    expect(() => normalizeRepositoryPath(path)).toThrow('Invalid path');
  });
});

describe('getFilesToCommit', () => {
  let fixture: GitFixture;

  beforeEach(async () => {
    fixture = await createGitFixture({
      'keep.txt': 'keep',
      'modify.txt': 'old',
      'delete.txt': 'delete',
      'rename-old.txt': 'rename',
      'copy-source.txt': 'copy',
      'nested/file.txt': 'nested',
    });
    vi.mocked(warning).mockClear();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('detect-changes: all', () => {
    it('returns nothing without changes', async () => {
      expect(await collect(fixture, 'all')).toEqual({ additions: {}, deletions: [] });
    });

    it('detects added, modified, and deleted files', async () => {
      await fixture.write('new.txt', 'new');
      await fixture.write('modify.txt', 'new');
      fixture.git('rm', '--quiet', 'delete.txt');
      await fixture.write('nested/file.txt', 'changed');

      expect(await collect(fixture, 'all')).toEqual({
        additions: { 'modify.txt': 'new', 'nested/file.txt': 'changed', 'new.txt': 'new' },
        deletions: ['delete.txt'],
      });
    });

    it('detects unstaged deletions', async () => {
      await rm(join(fixture.dir, 'delete.txt'));
      expect(await collect(fixture, 'all')).toEqual({ additions: {}, deletions: ['delete.txt'] });
      expect(await collect(fixture, 'staged')).toEqual({ additions: {}, deletions: [] });
    });

    it('expands untracked directories into files', async () => {
      await fixture.write('dist/index.js', 'index');
      await fixture.write('dist/sub/chunk.js', 'chunk');

      expect(await collect(fixture, 'all')).toEqual({
        additions: { 'dist/index.js': 'index', 'dist/sub/chunk.js': 'chunk' },
        deletions: [],
      });
    });

    it('ignores files matched by .gitignore', async () => {
      await fixture.write('.gitignore', 'ignored/\n');
      await fixture.write('ignored/file.txt', 'ignored');

      expect(await collect(fixture, 'all')).toEqual({ additions: { '.gitignore': 'ignored/\n' }, deletions: [] });
    });

    it('resolves staged renames to an addition and a deletion', async () => {
      fixture.git('mv', 'rename-old.txt', 'rename-new.txt');

      expect(await collect(fixture, 'all')).toEqual({
        additions: { 'rename-new.txt': 'rename' },
        deletions: ['rename-old.txt'],
      });
    });

    it('keeps the source of a copy', async () => {
      await fixture.write('copy-target.txt', 'copy');
      fixture.git('add', 'copy-target.txt');

      expect(await collect(fixture, 'all')).toEqual({ additions: { 'copy-target.txt': 'copy' }, deletions: [] });
    });

    it('uses the working tree contents of partially staged files', async () => {
      await fixture.write('modify.txt', 'staged');
      fixture.git('add', 'modify.txt');
      await fixture.write('modify.txt', 'working tree');

      expect(await collect(fixture, 'all')).toEqual({ additions: { 'modify.txt': 'working tree' }, deletions: [] });
    });

    it('skips files that were added and removed again', async () => {
      await fixture.write('temp.txt', 'temp');
      fixture.git('add', 'temp.txt');
      fixture.git('rm', '--quiet', '--cached', 'temp.txt');
      fixture.git('clean', '--quiet', '--force', 'temp.txt');

      expect(await collect(fixture, 'all')).toEqual({ additions: {}, deletions: [] });
    });

    it('commits binary files unchanged', async () => {
      const bytes = Buffer.from([0, 255, 1, 254, 10, 13]);
      await writeFile(join(fixture.dir, 'binary.bin'), bytes);

      const { additions } = await getFilesToCommit({
        workingDirectory: fixture.dir,
        additionsList: [],
        deletionsList: [],
        detectChanges: 'all',
      });
      expect(Buffer.from(additions[0].contents, 'base64')).toEqual(bytes);
    });

    it('warns about executable files', async () => {
      await fixture.write('script.sh', '#!/bin/sh');
      await chmod(join(fixture.dir, 'script.sh'), 0o755);

      await collect(fixture, 'all');
      expect(warning).toHaveBeenCalledWith('The executable bit is not preserved: script.sh');
    });

    it('rejects symbolic links', async () => {
      await symlink('keep.txt', join(fixture.dir, 'link.txt'));
      await expect(collect(fixture, 'all')).rejects.toThrow('Symbolic links are not supported: link.txt');
    });

    it('rejects a file replaced by a symbolic link', async () => {
      await rm(join(fixture.dir, 'modify.txt'));
      await symlink('keep.txt', join(fixture.dir, 'modify.txt'));
      await expect(collect(fixture, 'all')).rejects.toThrow('Symbolic links are not supported: modify.txt');
    });

    it('rejects paths with merge conflicts', async () => {
      fixture.git('checkout', '--quiet', '-b', 'other');
      await fixture.write('modify.txt', 'other');
      fixture.git('commit', '--quiet', '-am', 'other');
      fixture.git('checkout', '--quiet', 'main');
      await fixture.write('modify.txt', 'main');
      fixture.git('commit', '--quiet', '-am', 'main');
      try {
        fixture.git('merge', '--quiet', 'other');
      } catch {
        // expected merge conflict
      }
      await expect(collect(fixture, 'all')).rejects.toThrow('merge conflicts: modify.txt');
      await expect(collect(fixture, 'staged')).rejects.toThrow('merge conflicts: modify.txt');
    });

    it('works in a repository without commits', async () => {
      const empty = await createGitFixture();
      try {
        await empty.write('first.txt', 'first');
        expect(await collect(empty, 'all')).toEqual({ additions: { 'first.txt': 'first' }, deletions: [] });
      } finally {
        await empty.cleanup();
      }
    });
  });

  describe('detect-changes: staged', () => {
    it('detects only staged changes', async () => {
      await fixture.write('staged.txt', 'staged');
      fixture.git('add', 'staged.txt');
      await fixture.write('unstaged.txt', 'unstaged');
      await fixture.write('modify.txt', 'unstaged change');
      fixture.git('rm', '--quiet', 'delete.txt');

      expect(await collect(fixture, 'staged')).toEqual({
        additions: { 'staged.txt': 'staged' },
        deletions: ['delete.txt'],
      });
    });

    it('uses the index contents of partially staged files', async () => {
      await fixture.write('modify.txt', 'staged');
      fixture.git('add', 'modify.txt');
      await fixture.write('modify.txt', 'working tree');

      expect(await collect(fixture, 'staged')).toEqual({ additions: { 'modify.txt': 'staged' }, deletions: [] });
    });

    it('resolves renames and keeps the source of copies', async () => {
      fixture.git('mv', 'rename-old.txt', 'rename-new.txt');
      await fixture.write('copy-target.txt', 'copy');
      fixture.git('add', 'copy-target.txt');

      expect(await collect(fixture, 'staged')).toEqual({
        additions: { 'copy-target.txt': 'copy', 'rename-new.txt': 'rename' },
        deletions: ['rename-old.txt'],
      });
    });

    it('includes all files staged in new directories', async () => {
      await fixture.write('dist/index.js', 'index');
      await fixture.write('dist/sub/chunk.js', 'chunk');
      fixture.git('add', '--all');

      expect(await collect(fixture, 'staged')).toEqual({
        additions: { 'dist/index.js': 'index', 'dist/sub/chunk.js': 'chunk' },
        deletions: [],
      });
    });

    it('warns about executable files', async () => {
      await fixture.write('script.sh', '#!/bin/sh');
      await chmod(join(fixture.dir, 'script.sh'), 0o755);
      fixture.git('add', 'script.sh');

      await collect(fixture, 'staged');
      expect(warning).toHaveBeenCalledWith('The executable bit is not preserved: script.sh');
    });

    it('rejects symbolic links', async () => {
      await symlink('keep.txt', join(fixture.dir, 'link.txt'));
      fixture.git('add', 'link.txt');
      await expect(collect(fixture, 'staged')).rejects.toThrow('Symbolic links are not supported: link.txt');
    });

    it('rejects submodules', async () => {
      const sub = await createGitFixture({ 'sub.txt': 'sub' });
      try {
        fixture.git('-c', 'protocol.file.allow=always', 'submodule', '--quiet', 'add', sub.dir, 'sub');
        await expect(collect(fixture, 'staged')).rejects.toThrow('submodules are not supported: sub');
      } finally {
        await sub.cleanup();
      }
    });
  });

  describe('explicit additions and deletions', () => {
    it('uses explicit paths without detection', async () => {
      await fixture.write('modify.txt', 'new');
      await fixture.write('other.txt', 'other');

      expect(
        await collect(fixture, 'none', { additionsList: ['./modify.txt'], deletionsList: ['delete.txt'] }),
      ).toEqual({ additions: { 'modify.txt': 'new' }, deletions: ['delete.txt'] });
    });

    it('works in a directory that is not a Git repository', async () => {
      const dir = await createTempDir();
      await mkdir(join(dir, 'sub'));
      await writeFile(join(dir, 'sub', 'file.txt'), 'plain');

      const { additions } = await getFilesToCommit({
        workingDirectory: dir,
        additionsList: ['sub/file.txt'],
        deletionsList: [],
        detectChanges: 'none',
      });
      expect(additions.map(({ path }) => path)).toEqual(['sub/file.txt']);
    });

    it('takes precedence over detected changes', async () => {
      await fixture.write('modify.txt', 'new');
      fixture.git('rm', '--quiet', 'delete.txt');
      await fixture.write('delete.txt', 'restored');

      expect(await collect(fixture, 'all', { deletionsList: ['modify.txt'] })).toEqual({
        additions: { 'delete.txt': 'restored' },
        deletions: ['modify.txt'],
      });
    });

    it('rejects missing files', async () => {
      await expect(collect(fixture, 'none', { additionsList: ['missing.txt'] })).rejects.toThrow(
        'File not found: missing.txt',
      );
    });

    it('rejects directories', async () => {
      await expect(collect(fixture, 'none', { additionsList: ['nested'] })).rejects.toThrow('Not a file: nested');
    });

    it('rejects paths that are both added and deleted', async () => {
      await expect(
        collect(fixture, 'none', { additionsList: ['keep.txt'], deletionsList: ['keep.txt'] }),
      ).rejects.toThrow('both added and deleted: keep.txt');
    });
  });

  describe('working directory', () => {
    it('must be a Git repository when detecting changes', async () => {
      const dir = await createTempDir();
      await expect(
        getFilesToCommit({ workingDirectory: dir, additionsList: [], deletionsList: [], detectChanges: 'all' }),
      ).rejects.toThrow('is not a Git repository');
    });

    it('must be the repository root when detecting changes', async () => {
      await expect(
        getFilesToCommit({
          workingDirectory: join(fixture.dir, 'nested'),
          additionsList: [],
          deletionsList: [],
          detectChanges: 'all',
        }),
      ).rejects.toThrow('must be the root of the Git repository');
    });
  });
});
