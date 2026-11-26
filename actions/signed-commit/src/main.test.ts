import { info, setOutput, warning } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import { getFilesToCommit } from './get-files-to-commit.js';
import { getHeadOid, getRepositoryRoot } from './git.js';
import { createBranch, createCommitOnBranch, createTag, getBranchHeadOid, getDefaultBranch } from './github-api.js';
import { main } from './main.js';
import type { FileChanges, ParsedActionInputs } from './signed-commit.types.js';
import { writeSummary } from './summary.js';
import { syncLocal } from './sync-local.js';

vi.mock('@actions/core', () => ({
  endGroup: vi.fn(),
  info: vi.fn(),
  setOutput: vi.fn(),
  startGroup: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('./create-octokit.js', () => ({ createOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./get-files-to-commit.js', () => ({ getFilesToCommit: vi.fn() }));
vi.mock('./git.js', () => ({ getHeadOid: vi.fn(), getRepositoryRoot: vi.fn() }));
vi.mock('./github-api.js', () => ({
  createBranch: vi.fn(),
  createCommitOnBranch: vi.fn(),
  createTag: vi.fn(),
  getBranchHeadOid: vi.fn(),
  getDefaultBranch: vi.fn(),
}));
vi.mock('./summary.js', () => ({ writeSummary: vi.fn() }));
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
  tagType: 'annotated',
  tagMessage: '{tag}',
  ifNoChanges: 'error',
  sync: true,
  expectedHeadOid: '',
  shouldCreateBranch: false,
  base: '',
  filePatterns: [],
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

    expect(createOctokit).toHaveBeenCalledWith('token');
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
    expect(setOutput).toHaveBeenCalledWith('commit-url', `https://github.com/owner/repo/commit/${commitOid}`);
    expect(syncLocal).toHaveBeenCalledWith({
      workingDirectory: '/work',
      branch: 'main',
      parentOid: remoteHead,
      commitOid,
      tags: [],
      tagType: 'annotated',
      switchBranch: false,
    });
    expect(writeSummary).toHaveBeenCalledWith({
      repository: 'owner/repo',
      branch: 'main',
      head: { oid: remoteHead },
      message: { headline: 'chore: update' },
      commitOid,
      commitUrl: `https://github.com/owner/repo/commit/${commitOid}`,
      tags: [],
      tagType: 'annotated',
      fileChanges: someChanges,
    });
    expect(createBranch).not.toHaveBeenCalled();
  });

  it('links the commit on the server of the workflow', async () => {
    setup();
    vi.stubEnv('GITHUB_SERVER_URL', 'https://github.example.com');
    await main();
    expect(setOutput).toHaveBeenCalledWith('commit-url', `https://github.example.com/owner/repo/commit/${commitOid}`);
    vi.unstubAllEnvs();
  });

  it('creates every tag with its own call, in order', async () => {
    setup({ tags: ['a/v1.0.0', 'b/v2.0.0'] });
    vi.mocked(createTag).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await main();

    expect(vi.mocked(createTag).mock.calls.map(call => call[2])).toEqual(['a/v1.0.0', 'b/v2.0.0']);
    expect(info).toHaveBeenCalledWith('Created annotated tag a/v1.0.0.');
    expect(info).toHaveBeenCalledWith(`The annotated tag b/v2.0.0 already points to ${commitOid}.`);
  });

  it('fills the tag name into the message of every tag', async () => {
    setup({ tags: ['a/v1.0.0', 'b/v2.0.0'], tagMessage: 'Release {tag}\n\nSee {tag}.' });
    await main();

    expect(vi.mocked(createTag).mock.calls.map(call => call[4])).toEqual([
      { type: 'annotated', message: 'Release a/v1.0.0\n\nSee a/v1.0.0.' },
      { type: 'annotated', message: 'Release b/v2.0.0\n\nSee b/v2.0.0.' },
    ]);
  });

  it('keeps replacement patterns in tag names literal', async () => {
    setup({ tags: ['v$&1'], tagMessage: 'Release {tag}' });
    await main();
    expect(vi.mocked(createTag).mock.calls[0][4]).toEqual({ type: 'annotated', message: 'Release v$&1' });
  });

  it('creates lightweight tags', async () => {
    setup({ tags: ['v1.0.0'], tagType: 'lightweight' });
    await main();

    expect(createTag).toHaveBeenCalledWith({}, { owner: 'owner', repo: 'repo' }, 'v1.0.0', commitOid, {
      type: 'lightweight',
      message: 'v1.0.0',
    });
    expect(info).toHaveBeenCalledWith('Created lightweight tag v1.0.0.');
    expect(vi.mocked(syncLocal).mock.calls[0][0].tagType).toBe('lightweight');
  });

  it.each([
    ['annotated', 41, 82],
    ['lightweight', 81, 81],
  ] as const)('warns before creating many %s tags', async (tagType, count, requests) => {
    setup({ tagType, tags: Array.from({ length: count }, (_, index) => `pkg-${index}/v1.0.0`) });
    await main();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining(`Creating ${count} ${tagType} tags takes ${requests} requests`),
    );
    expect(createTag).toHaveBeenCalledTimes(count);
  });

  it.each([
    [40, 'annotated'],
    [80, 'lightweight'],
  ] as const)('does not warn for up to %i %s tags', async (count, tagType) => {
    setup({ tagType, tags: Array.from({ length: count }, (_, index) => `pkg-${index}/v1.0.0`) });
    await main();
    expect(warning).not.toHaveBeenCalled();
  });

  it('does not sync when disabled', async () => {
    setup({ sync: false });
    await main();
    expect(syncLocal).not.toHaveBeenCalled();
  });

  it('fails if the branch does not exist', async () => {
    setup();
    vi.mocked(getBranchHeadOid).mockResolvedValue(undefined);
    await expect(main()).rejects.toThrow(
      'The branch "main" does not exist in owner/repo. Set "create-branch" to "true" to create it',
    );
  });

  describe('create-branch', () => {
    const baseHead = 'd'.repeat(40);

    /**
     * Mocks a missing branch "feature" and an existing branch "main".
     */
    function mockBranches(): void {
      vi.mocked(getBranchHeadOid).mockImplementation(async (_octokit, _repository, branch) =>
        branch === 'main' ? baseHead : undefined,
      );
    }

    it('creates a missing branch from the default branch and commits on it', async () => {
      setup({ branch: 'feature', shouldCreateBranch: true });
      mockBranches();
      vi.mocked(getDefaultBranch).mockResolvedValue('main');
      await main();
      expect(createBranch).toHaveBeenCalledWith({}, { owner: 'owner', repo: 'repo' }, 'feature', baseHead);
      expect(info).toHaveBeenCalledWith(`Created branch feature from main at ${baseHead}.`);
      expect(createCommitOnBranch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ branch: 'feature', expectedHeadOid: baseHead }),
      );
      expect(vi.mocked(syncLocal).mock.calls[0][0].switchBranch).toBe(true);
      expect(vi.mocked(writeSummary).mock.calls[0][0].head).toEqual({ oid: baseHead, createdFrom: 'main' });
    });

    it('creates a missing branch from a base branch', async () => {
      setup({ branch: 'feature', shouldCreateBranch: true, base: 'main' });
      mockBranches();
      await main();
      expect(getDefaultBranch).not.toHaveBeenCalled();
      expect(createBranch).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'feature', baseHead);
    });

    it('creates a missing branch from a commit', async () => {
      setup({ branch: 'feature', shouldCreateBranch: true, base: 'e'.repeat(40) });
      mockBranches();
      await main();
      expect(getBranchHeadOid).toHaveBeenCalledTimes(1);
      expect(createBranch).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'feature', 'e'.repeat(40));
    });

    it('commits to an existing branch without creating it', async () => {
      setup({ shouldCreateBranch: true, base: 'other' });
      await main();
      expect(createBranch).not.toHaveBeenCalled();
    });

    it('fails if the base branch is missing', async () => {
      setup({ branch: 'feature', shouldCreateBranch: true, base: 'missing' });
      mockBranches();
      await expect(main()).rejects.toThrow(
        'The base branch "missing" of the new branch "feature" does not exist in owner/repo.',
      );
      expect(createBranch).not.toHaveBeenCalled();
    });

    it('fails before creating the branch if the local HEAD is not the base', async () => {
      setup({ branch: 'feature', shouldCreateBranch: true, base: 'main' }, { localHead: 'c'.repeat(40) });
      mockBranches();
      await expect(main()).rejects.toThrow('The branch "feature" is at');
      expect(createBranch).not.toHaveBeenCalled();
    });

    it('creates the branch and the tags without changes', async () => {
      setup(
        { branch: 'feature', shouldCreateBranch: true, base: 'main', ifNoChanges: 'ignore', tags: ['v1.0.0'] },
        {
          changes: { additions: [], deletions: [] },
        },
      );
      mockBranches();
      await main();
      expect(createBranch).toHaveBeenCalled();
      expect(createTag).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'v1.0.0',
        baseHead,
        expect.anything(),
      );
    });
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

    it('warns with "warn" and creates the tags on the current head', async () => {
      setup({ ifNoChanges: 'warn', tags: ['v1.0.0'] }, { changes: noChanges });
      await main();
      expect(warning).toHaveBeenCalledWith('There are no changes to commit.');
      expect(setOutput).toHaveBeenCalledWith('commit-sha', '');
      expect(createCommitOnBranch).not.toHaveBeenCalled();
      expect(createTag).toHaveBeenCalledWith({}, { owner: 'owner', repo: 'repo' }, 'v1.0.0', remoteHead, {
        type: 'annotated',
        message: 'v1.0.0',
      });
      expect(info).toHaveBeenCalledWith(`Tagging the current head ${remoteHead} of main.`);
      expect(writeSummary).toHaveBeenCalledWith(
        expect.objectContaining({ commitUrl: '', tags: [{ name: 'v1.0.0', created: true }] }),
      );
    });

    it('does not tag the current head with "error"', async () => {
      setup({ tags: ['v1.0.0'] }, { changes: noChanges });
      await expect(main()).rejects.toThrow('There are no changes to commit.');
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
