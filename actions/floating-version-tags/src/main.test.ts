import { info, setOutput } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import type { ParsedActionInputs, TagState } from './floating-version-tags.types.js';
import { getTagState, listTagNames, writeTag } from './github-api.js';
import { main } from './main.js';
import { writeSummary } from './summary.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn() }));
vi.mock('./create-octokit.js', () => ({ createOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./github-api.js', () => ({ getTagState: vi.fn(), listTagNames: vi.fn(), writeTag: vi.fn() }));
vi.mock('./summary.js', () => ({ writeSummary: vi.fn() }));

const repository = { owner: 'owner', repo: 'repo' };
const inputs: ParsedActionInputs = {
  token: 'token',
  owner: 'owner',
  repo: 'repo',
  tag: 'v1.2.0',
  naming: { prefix: '', vPrefix: true },
  major: true,
  minor: false,
  latest: false,
  annotated: false,
  dryRun: false,
};

/**
 * Mocks the tags of the repository.
 *
 * @param tags - The commit SHA of every tag; a tag object is marked with a trailing `*`.
 */
function mockTags(tags: Record<string, string>): void {
  vi.mocked(getTagState).mockImplementation(async (_octokit, _repository, tag): Promise<TagState | undefined> =>
    tag in tags ? { commit: tags[tag].replace(/\*$/, ''), annotated: tags[tag].endsWith('*') } : undefined,
  );
  vi.mocked(listTagNames).mockImplementation(async (_octokit, _repository, prefix) =>
    Object.keys(tags).filter(tag => tag.startsWith(prefix)),
  );
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
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, {
      tag: 'v1',
      sha: 'new',
      exists: false,
      message: undefined,
    });
    expect(info).toHaveBeenCalledWith('Created v1 at v1.2.0 (lightweight).');
    expect(writeSummary).toHaveBeenCalledWith([{ name: 'v1', action: 'created', reason: 'at v1.2.0 (lightweight)' }], {
      repository: 'owner/repo',
      release: 'v1.2.0',
      commit: 'new',
      dryRun: false,
    });
    expect(movedOutput()).toEqual(['v1']);
  });

  it('moves the major tag forward', async () => {
    mockTags({ 'v1.1.0': 'old', 'v1.2.0': 'new', v1: 'old' });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, {
      tag: 'v1',
      sha: 'new',
      exists: true,
      message: undefined,
    });
    expect(info).toHaveBeenCalledWith('Moved v1 to v1.2.0 (lightweight).');
    expect(movedOutput()).toEqual(['v1']);
  });

  it('moves an annotated tag with a message', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, annotated: true });
    mockTags({ 'v1.1.0': 'old', 'v1.2.0': 'new', v1: 'old*' });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, {
      tag: 'v1',
      sha: 'new',
      exists: true,
      message: 'v1 → v1.2.0 (latest stable release of major version 1)',
    });
    expect(info).toHaveBeenCalledWith('Moved v1 to v1.2.0 (annotated).');
  });

  it('replaces a tag of the other kind at the same commit', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, annotated: true });
    mockTags({ 'v1.2.0': 'new', v1: 'new' });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, expect.objectContaining({ exists: true }));
    expect(info).toHaveBeenCalledWith('Replaced v1 by an annotated tag at v1.2.0.');
    expect(movedOutput()).toEqual(['v1']);
  });

  it('replaces an annotated tag whose message names another release', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, annotated: true });
    mockTags({ 'v1.1.0': 'new', 'v1.2.0': 'new', v1: 'new*' });
    const outdated = 'v1 → v1.1.0 (latest stable release of major version 1)';
    const getState = vi.mocked(getTagState).getMockImplementation();
    vi.mocked(getTagState).mockImplementation(async (octokit, repositoryRef, tag) => {
      const state = await getState?.(octokit, repositoryRef, tag);
      return tag === 'v1' && state ? { ...state, message: outdated } : state;
    });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, {
      tag: 'v1',
      sha: 'new',
      exists: true,
      message: 'v1 → v1.2.0 (latest stable release of major version 1)',
    });
    expect(info).toHaveBeenCalledWith('Replaced v1 by an annotated tag at v1.2.0.');
  });

  it('keeps an annotated tag with the message of the release', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, annotated: true });
    mockTags({ 'v1.2.0': 'new', v1: 'new*' });
    const getState = vi.mocked(getTagState).getMockImplementation();
    vi.mocked(getTagState).mockImplementation(async (octokit, repositoryRef, tag) => {
      const state = await getState?.(octokit, repositoryRef, tag);
      return tag === 'v1' && state
        ? { ...state, message: 'v1 → v1.2.0 (latest stable release of major version 1)' }
        : state;
    });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Kept v1: already at v1.2.0.');
  });

  it('replaces an annotated tag by a lightweight tag', async () => {
    mockTags({ 'v1.2.0': 'new', v1: 'new*' });
    await main();
    expect(info).toHaveBeenCalledWith('Replaced v1 by a lightweight tag at v1.2.0.');
  });

  it('never moves a tag backward', async () => {
    mockTags({ 'v1.2.0': 'old', 'v1.3.0': 'new', v1: 'new' });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Kept v1: v1.3.0 is newer.');
    expect(movedOutput()).toEqual([]);
  });

  it('ignores newer prereleases and other major versions', async () => {
    mockTags({ 'v1.2.0': 'new', 'v1.3.0-beta.1': 'beta', 'v2.0.0': 'two', v1: 'old' });
    await main();
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, expect.objectContaining({ sha: 'new' }));
  });

  it('changes nothing if the tag already points to the release', async () => {
    mockTags({ 'v1.2.0': 'new', v1: 'new' });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Kept v1: already at v1.2.0.');
    expect(movedOutput()).toEqual([]);
  });

  it('moves minor and latest tags within their lines', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, tag: 'v1.2.5', minor: true, latest: true });
    mockTags({ 'v1.2.5': 'new', 'v1.3.0': 'later', 'v1.2': 'old', latest: 'later' });
    await main();
    expect(vi.mocked(writeTag).mock.calls.map(call => call[2].tag)).toEqual(['v1.2']);
    expect(info).toHaveBeenCalledWith('Kept v1: v1.3.0 is newer.');
    expect(info).toHaveBeenCalledWith('Kept latest: v1.3.0 is newer.');
    expect(movedOutput()).toEqual(['v1.2']);
  });

  it('moves the floating tags of a prefix', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({
      ...inputs,
      tag: 'pkg/1.0.1',
      naming: { prefix: 'pkg/', vPrefix: false },
    });
    mockTags({ 'pkg/1.0.0': 'old', 'pkg/1.0.1': 'new', 'pkg/1': 'old', 'other/1.5.0': 'other' });
    await main();
    expect(listTagNames).toHaveBeenCalledWith(expect.anything(), repository, 'pkg/');
    expect(writeTag).toHaveBeenCalledWith(expect.anything(), repository, expect.objectContaining({ tag: 'pkg/1' }));
  });

  it('only reports the changes with dry-run', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, dryRun: true, latest: true });
    mockTags({ 'v1.2.0': 'new', v1: 'old' });
    await main();
    expect(writeTag).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Would move v1 to v1.2.0 (lightweight).');
    expect(info).toHaveBeenCalledWith('Would create latest at v1.2.0 (lightweight).');
    expect(vi.mocked(writeSummary).mock.calls[0][1].dryRun).toBe(true);
    expect(movedOutput()).toEqual(['v1', 'latest']);
  });

  it('fails for a missing release tag', async () => {
    mockTags({ v1: 'old' });
    await expect(main()).rejects.toThrow(
      'The tag "v1.2.0" does not exist in owner/repo. Create it before moving floating tags.',
    );
    expect(writeTag).not.toHaveBeenCalled();
  });

  it('fails for a prerelease before any request', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, tag: 'v1.2.0-rc.1' });
    await expect(main()).rejects.toThrow('is a prerelease');
    expect(getTagState).not.toHaveBeenCalled();
  });
});
