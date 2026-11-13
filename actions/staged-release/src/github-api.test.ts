import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  assertTagExists,
  createDraftRelease,
  deleteRelease,
  listReleasesOfTag,
  publishRelease,
  uploadAsset,
  type Octokit,
  type Release,
} from './github-api.js';

const repository = { owner: 'owner', repo: 'repo' };
const release: Release = { id: 9, tag_name: 'v1.0.0', draft: true, html_url: 'https://release', upload_url: 'x' };

/**
 * Creates a fake Octokit client.
 *
 * @param rest - Mocked methods of `rest.git` and `rest.repos`.
 * @param pages - The result of `paginate`.
 * @returns The fake client.
 */
function fakeOctokit(rest: Record<string, unknown> = {}, pages: unknown[] = []): Octokit {
  return {
    paginate: vi.fn().mockResolvedValue(pages),
    rest: {
      git: { getRef: rest.getRef ?? vi.fn().mockResolvedValue({}) },
      repos: {
        listReleases: vi.fn(),
        deleteRelease: rest.deleteRelease ?? vi.fn(),
        createRelease: rest.createRelease ?? vi.fn(),
        uploadReleaseAsset: rest.uploadReleaseAsset ?? vi.fn(),
        updateRelease: rest.updateRelease ?? vi.fn(),
      },
    },
  } as unknown as Octokit;
}

/**
 * Creates an HTTP error like Octokit does.
 *
 * @param status - The HTTP status.
 * @returns The error.
 */
function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('assertTagExists', () => {
  it('accepts an existing tag', async () => {
    const getRef = vi.fn().mockResolvedValue({ data: {} });
    await assertTagExists(fakeOctokit({ getRef }), repository, 'v1.0.0');
    expect(getRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'tags/v1.0.0' });
  });

  it('fails for a missing tag', async () => {
    const getRef = vi.fn().mockRejectedValue(httpError(404));
    await expect(assertTagExists(fakeOctokit({ getRef }), repository, 'v1.0.0')).rejects.toThrow(
      'The tag "v1.0.0" does not exist in owner/repo.',
    );
  });

  it('passes other errors through', async () => {
    const getRef = vi.fn().mockRejectedValue(httpError(500));
    await expect(assertTagExists(fakeOctokit({ getRef }), repository, 'v1.0.0')).rejects.toThrow('HTTP 500');
  });
});

describe('listReleasesOfTag', () => {
  it('returns only the releases of the tag', async () => {
    const other = { ...release, id: 2, tag_name: 'v0.9.0' };
    expect(await listReleasesOfTag(fakeOctokit({}, [release, other]), repository, 'v1.0.0')).toEqual([release]);
  });
});

describe('release requests', () => {
  it('deletes a release', async () => {
    const remove = vi.fn();
    await deleteRelease(fakeOctokit({ deleteRelease: remove }), repository, 3);
    expect(remove).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', release_id: 3 });
  });

  it('creates a draft release', async () => {
    const createRelease = vi.fn().mockResolvedValue({ data: release });
    const result = await createDraftRelease(fakeOctokit({ createRelease }), {
      repository,
      tag: 'v1.0.0',
      name: 'v1.0.0',
      body: 'Notes',
      prerelease: false,
    });
    expect(result).toBe(release);
    expect(createRelease).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      tag_name: 'v1.0.0',
      name: 'v1.0.0',
      body: 'Notes',
      prerelease: false,
      draft: true,
    });
  });

  it('uploads an asset as binary data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'staged-release-upload-'));
    try {
      const path = join(directory, 'a.tar.gz');
      await writeFile(path, Buffer.from([0, 1, 2]));
      const uploadReleaseAsset = vi
        .fn()
        .mockResolvedValue({ data: { name: 'a.tar.gz', size: 3, browser_download_url: 'https://download' } });

      expect(
        await uploadAsset(fakeOctokit({ uploadReleaseAsset }), repository, release, {
          path,
          name: 'a.tar.gz',
          size: 3,
        }),
      ).toEqual({ name: 'a.tar.gz', size: 3, url: 'https://download' });
      expect(uploadReleaseAsset).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        release_id: 9,
        name: 'a.tar.gz',
        data: Buffer.from([0, 1, 2]),
        headers: { 'content-type': 'application/octet-stream' },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('publishes a draft release', async () => {
    const updateRelease = vi.fn().mockResolvedValue({ data: { ...release, draft: false } });
    expect((await publishRelease(fakeOctokit({ updateRelease }), repository, release, 'legacy')).draft).toBe(false);
    expect(updateRelease).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 9,
      draft: false,
      make_latest: 'legacy',
    });
  });
});
