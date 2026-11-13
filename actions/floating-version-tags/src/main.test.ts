import { info, setOutput } from '@actions/core';
import { createOctokit } from '@simbo-actions/octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import type { ParsedActionInputs } from './floating-version-tags.types.js';
import { getTagCommit, listVersionTagNames, writeTag } from './github-api.js';
import { main } from './main.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn() }));
vi.mock('@simbo-actions/octokit', () => ({ createOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./github-api.js', () => ({ getTagCommit: vi.fn(), listVersionTagNames: vi.fn(), writeTag: vi.fn() }));

const repository = { owner: 'owner', repo: 'repo' };
const inputs: ParsedActionInputs = {
  token: 'token',
  owner: 'owner',
  repo: 'repo',
  tag: 'v1.2.0',
  major: true,
  minor: false,
  latest: false,
  dryRun: false,
};

/**
 * Mocks the tags of the repository.
 *
 * @param tags - The commit SHA of every tag.
 */
function mockTags(tags: Record<string, string>): void {
  vi.mocked(getTagCommit).mockImplementation(async (_octokit, _repository, tag) => tags[tag]);
  vi.mocked(listVersionTagNames).mockResolvedValue(Object.keys(tags).filter(tag => tag.startsWith('v')));
}

/**
 * Gets the value of the `moved` output.
 *
 * @returns The parsed output.
 */
function movedOutput(): unknown {
  const call = vi.mocked(setOutput).mock.calls.find(([name]) => name === 'moved');
  return JSON.parse(String(call?.[1]));
}

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseActionInputs).mockReturnValue(inputs);
  });

  it('creates a missing major tag', async () => {
    mockTags({ 'v1.2.0': 'new' });
    await main();
    expect(createOctokit).toHaveBeenCalledWith('token');
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, { tag: 'v1', sha: 'new', exists: false });
    expect(info).toHaveBeenCalledWith('Created v1 at v1.2.0 (new).');
    expect(movedOutput()).toEqual(['v1']);
  });

  it('moves the major tag forward', async () => {
    mockTags({ 'v1.1.0': 'old', 'v1.2.0': 'new', v1: 'old' });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, { tag: 'v1', sha: 'new', exists: true });
    expect(info).toHaveBeenCalledWith('Moved v1 to v1.2.0 (new).');
    expect(movedOutput()).toEqual(['v1']);
  });

  it('never moves a tag backward', async () => {
    mockTags({ 'v1.2.0': 'old', 'v1.3.0': 'new', v1: 'new' });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Kept v1: v1.3.0 is newer than v1.2.0.');
    expect(movedOutput()).toEqual([]);
  });

  it('ignores newer prereleases and other major versions', async () => {
    mockTags({ 'v1.2.0': 'new', 'v1.3.0-beta.1': 'beta', 'v2.0.0': 'two', v1: 'old' });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, { tag: 'v1', sha: 'new', exists: true });
  });

  it('changes nothing if the tag already points to the release', async () => {
    mockTags({ 'v1.2.0': 'new', v1: 'new' });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Kept v1: it already points to v1.2.0 (new).');
    expect(movedOutput()).toEqual([]);
  });

  it('moves minor and latest tags within their lines', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, tag: 'v1.2.5', minor: true, latest: true });
    mockTags({ 'v1.2.5': 'new', 'v1.3.0': 'later', 'v1.2': 'old', latest: 'later' });
    await main();
    expect(vi.mocked(writeTag).mock.calls.map(call => call[2].tag)).toEqual(['v1.2']);
    expect(info).toHaveBeenCalledWith('Kept v1: v1.3.0 is newer than v1.2.5.');
    expect(info).toHaveBeenCalledWith('Kept latest: v1.3.0 is newer than v1.2.5.');
    expect(movedOutput()).toEqual(['v1.2']);
  });

  it('only reports the changes with dry-run', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, dryRun: true, latest: true });
    mockTags({ 'v1.2.0': 'new', v1: 'old' });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Would move v1 to v1.2.0 (new).');
    expect(info).toHaveBeenCalledWith('Would create latest at v1.2.0 (new).');
    expect(movedOutput()).toEqual(['v1', 'latest']);
  });

  it('fails for a missing release tag', async () => {
    mockTags({ v1: 'old' });
    await expect(main()).rejects.toThrow('The tag "v1.2.0" does not exist in owner/repo.');
    expect(writeTag).not.toHaveBeenCalled();
  });

  it('fails for a prerelease before any request', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, tag: 'v1.2.0-rc.1' });
    await expect(main()).rejects.toThrow('is a prerelease');
    expect(getTagCommit).not.toHaveBeenCalled();
  });
});
