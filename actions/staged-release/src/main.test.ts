import { info, setOutput } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import { findAssets } from './find-assets.js';
import {
  assertTagExists,
  createDraftRelease,
  deleteRelease,
  listReleasesOfTag,
  publishRelease,
  uploadAsset,
  type Release,
} from './github-api.js';
import { main } from './main.js';
import type { ParsedActionInputs } from './staged-release.types.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn() }));
vi.mock('./create-octokit.js', () => ({ createOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./find-assets.js', () => ({ findAssets: vi.fn() }));
vi.mock('./github-api.js', () => ({
  assertTagExists: vi.fn(),
  createDraftRelease: vi.fn(),
  deleteRelease: vi.fn(),
  listReleasesOfTag: vi.fn(),
  publishRelease: vi.fn(),
  uploadAsset: vi.fn(),
}));

const inputs: ParsedActionInputs = {
  token: 'token',
  owner: 'owner',
  repo: 'repo',
  tag: 'v1.0.0',
  name: 'v1.0.0',
  body: 'Notes',
  assetPatterns: ['*.tar.gz'],
  workingDirectory: '.',
  makeLatest: 'true',
  prerelease: false,
  publish: true,
};
const draft: Release = { id: 9, tag_name: 'v1.0.0', draft: true, html_url: 'https://draft', upload_url: 'x' };
const published: Release = { ...draft, draft: false, html_url: 'https://release' };
const asset = { path: '/a.tar.gz', name: 'a.tar.gz', size: 3 };

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseActionInputs).mockResolvedValue(inputs);
    vi.mocked(findAssets).mockResolvedValue([asset]);
    vi.mocked(listReleasesOfTag).mockResolvedValue([]);
    vi.mocked(createDraftRelease).mockResolvedValue(draft);
    vi.mocked(uploadAsset).mockResolvedValue({ name: 'a.tar.gz', size: 3, url: 'https://download' });
    vi.mocked(publishRelease).mockResolvedValue(published);
  });

  it('creates a draft, uploads the assets, and publishes it', async () => {
    await main();

    expect(createOctokit).toHaveBeenCalledWith('token');
    expect(assertTagExists).toHaveBeenCalledWith(expect.anything(), { owner: 'owner', repo: 'repo' }, 'v1.0.0');
    expect(uploadAsset).toHaveBeenCalledWith(expect.anything(), { owner: 'owner', repo: 'repo' }, draft, asset);
    expect(publishRelease).toHaveBeenCalledWith(expect.anything(), { owner: 'owner', repo: 'repo' }, draft, 'true');
    expect(vi.mocked(setOutput).mock.calls).toEqual([
      ['release-id', '9'],
      ['url', 'https://release'],
      ['assets', JSON.stringify([{ name: 'a.tar.gz', size: 3, url: 'https://download' }])],
    ]);
  });

  it('resolves the assets before changing anything', async () => {
    vi.mocked(findAssets).mockRejectedValue(new Error('No file found'));
    await expect(main()).rejects.toThrow('No file found');
    expect(assertTagExists).not.toHaveBeenCalled();
    expect(createDraftRelease).not.toHaveBeenCalled();
  });

  it('removes leftover drafts of the tag', async () => {
    vi.mocked(listReleasesOfTag).mockResolvedValue([{ ...draft, id: 3 }]);
    await main();
    expect(deleteRelease).toHaveBeenCalledWith(expect.anything(), { owner: 'owner', repo: 'repo' }, 3);
    expect(info).toHaveBeenCalledWith('Removed leftover draft release 3 of v1.0.0.');
  });

  it('fails if the tag is already released', async () => {
    vi.mocked(listReleasesOfTag).mockResolvedValue([published]);
    await expect(main()).rejects.toThrow('The tag "v1.0.0" is already released: https://release');
    expect(createDraftRelease).not.toHaveBeenCalled();
  });

  it('leaves the release as draft with publish: false', async () => {
    vi.mocked(parseActionInputs).mockResolvedValue({ ...inputs, publish: false });
    await main();
    expect(publishRelease).not.toHaveBeenCalled();
    expect(setOutput).toHaveBeenCalledWith('url', 'https://draft');
  });
});
