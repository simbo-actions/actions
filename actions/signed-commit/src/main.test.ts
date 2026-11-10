import { info, setOutput, warning } from '@actions/core';
import { getOctokit } from '@actions/github';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { getFilesToCommit } from './get-files-to-commit.js';
import { getHeadOid, getRepositoryRoot } from './git.js';
import { createCommitOnBranch, createTag, getBranchHeadOid } from './github-api.js';
import { main } from './main.js';
import type { FileChanges, ParsedActionInputs } from './signed-commit.types.js';
import { syncLocal } from './sync-local.js';

vi.mock('@actions/core', () => ({
  endGroup: vi.fn(),
  info: vi.fn(),
  setOutput: vi.fn(),
  startGroup: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@actions/github', () => ({ getOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./get-files-to-commit.js', () => ({ getFilesToCommit: vi.fn() }));
vi.mock('./git.js', () => ({ getHeadOid: vi.fn(), getRepositoryRoot: vi.fn() }));
vi.mock('./github-api.js', () => ({ createCommitOnBranch: vi.fn(), createTag: vi.fn(), getBranchHeadOid: vi.fn() }));
vi.mock('./sync-local.js', () => ({ syncLocal: vi.fn() }));

const remoteHead = 'a'.repeat(40);
const commitOid = 'b'.repeat(40);

const defaultInputs: ParsedActionInputs = {
  token: 'token',
  message: { headline: 'chore: update' },
  owner: 'owner',
  repo: 'repo',
  branch: 'main',
  workingDirectory: '/work',
  additionsList: [],
  deletionsList: [],
  detectChanges: 'all',
  tags: [],
  ifNoChanges: 'error',
  sync: true,
  expectedHeadOid: '',
};

const someChanges: FileChanges = {
  additions: [{ path: 'a.txt', contents: 'YQ==' }],
  deletions: [{ path: 'b.txt' }],
};

/**
 * Sets up the mocks for a run.
 *
 * @param inputs - Input overrides.
 * @param options - Mock options.
 * @param options.changes - The detected changes.
 * @param options.localHead - The local HEAD, or `undefined` outside of a Git repository.
 */
function setup(
  inputs: Partial<ParsedActionInputs> = {},
  options: { changes?: FileChanges; localHead?: string } = {},
): void {
  vi.mocked(parseActionInputs).mockReturnValue({ ...defaultInputs, ...inputs });
  vi.mocked(getBranchHeadOid).mockResolvedValue(remoteHead);
  vi.mocked(getRepositoryRoot).mockResolvedValue('localHead' in options ? '/work' : undefined);
  vi.mocked(getHeadOid).mockResolvedValue(options.localHead);
  vi.mocked(getFilesToCommit).mockResolvedValue(options.changes ?? someChanges);
  vi.mocked(createCommitOnBranch).mockResolvedValue(commitOid);
  vi.mocked(createTag).mockResolvedValue(true);
}

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a verified commit and sets the outputs', async () => {
    setup({}, { localHead: remoteHead });
    await main();

    expect(getOctokit).toHaveBeenCalledWith('token');
    expect(createCommitOnBranch).toHaveBeenCalledWith(expect.anything(), {
      repository: { owner: 'owner', repo: 'repo' },
      branch: 'main',
      expectedHeadOid: remoteHead,
      message: { headline: 'chore: update' },
      fileChanges: someChanges,
    });
    expect(setOutput).toHaveBeenCalledWith('files', JSON.stringify({ additions: ['a.txt'], deletions: ['b.txt'] }));
    expect(setOutput).toHaveBeenCalledWith('committed', 'true');
    expect(setOutput).toHaveBeenCalledWith('commit-sha', commitOid);
    expect(syncLocal).toHaveBeenCalledWith({
      workingDirectory: '/work',
      branch: 'main',
      parentOid: remoteHead,
      commitOid,
      tags: [],
    });
  });

  it('creates every tag with its own call, in order', async () => {
    setup({ tags: ['a/v1.0.0', 'b/v2.0.0'] });
    vi.mocked(createTag).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await main();

    expect(vi.mocked(createTag).mock.calls.map(call => call[2])).toEqual(['a/v1.0.0', 'b/v2.0.0']);
    expect(info).toHaveBeenCalledWith('Created tag a/v1.0.0.');
    expect(info).toHaveBeenCalledWith(`Tag b/v2.0.0 already points to ${commitOid}.`);
  });

  it('does not sync when disabled', async () => {
    setup({ sync: false });
    await main();
    expect(syncLocal).not.toHaveBeenCalled();
  });

  it('fails if the branch does not exist', async () => {
    setup();
    vi.mocked(getBranchHeadOid).mockResolvedValue(undefined);
    await expect(main()).rejects.toThrow('The branch "main" does not exist in owner/repo');
  });

  describe('expected head', () => {
    it('fails if the local HEAD differs from the remote head', async () => {
      setup({}, { localHead: 'c'.repeat(40) });
      await expect(main()).rejects.toThrow('The branch has moved');
      expect(createCommitOnBranch).not.toHaveBeenCalled();
    });

    it('uses the remote head outside of a Git repository', async () => {
      setup();
      await main();
      expect(createCommitOnBranch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedHeadOid: remoteHead }),
      );
    });

    it('uses the remote head in a repository without commits', async () => {
      setup({}, { localHead: undefined });
      await main();
      expect(createCommitOnBranch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedHeadOid: remoteHead }),
      );
    });

    it('uses the remote head with "remote"', async () => {
      setup({ expectedHeadOid: 'remote' }, { localHead: 'c'.repeat(40) });
      await main();
      expect(createCommitOnBranch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedHeadOid: remoteHead }),
      );
    });

    it('accepts an explicit SHA that matches', async () => {
      setup({ expectedHeadOid: remoteHead });
      await main();
      expect(createCommitOnBranch).toHaveBeenCalled();
    });

    it('fails with an explicit SHA that differs', async () => {
      setup({ expectedHeadOid: 'c'.repeat(40) });
      await expect(main()).rejects.toThrow('but the expected-head-oid is');
    });

    it('rejects an invalid value', async () => {
      setup({ expectedHeadOid: 'abc' });
      await expect(main()).rejects.toThrow('Invalid input "expected-head-oid"');
    });
  });

  describe('without changes', () => {
    const noChanges: FileChanges = { additions: [], deletions: [] };

    it('fails with "error"', async () => {
      setup({}, { changes: noChanges });
      await expect(main()).rejects.toThrow('There are no changes to commit.');
      expect(setOutput).toHaveBeenCalledWith('committed', 'false');
      expect(createCommitOnBranch).not.toHaveBeenCalled();
    });

    it('warns with "warn" and skips tags', async () => {
      setup({ ifNoChanges: 'warn', tags: ['v1.0.0'] }, { changes: noChanges });
      await main();
      expect(warning).toHaveBeenCalledWith('There are no changes to commit.');
      expect(warning).toHaveBeenCalledWith('Skipping tags without a commit: v1.0.0');
      expect(setOutput).toHaveBeenCalledWith('commit-sha', '');
      expect(createTag).not.toHaveBeenCalled();
    });

    it('only logs with "ignore"', async () => {
      setup({ ifNoChanges: 'ignore' }, { changes: noChanges });
      await main();
      expect(info).toHaveBeenCalledWith('There are no changes to commit.');
      expect(warning).not.toHaveBeenCalled();
    });
  });
});
