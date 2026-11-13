import { describe, expect, it, vi } from 'vitest';

import { getTagCommit, listVersionTagNames, writeTag, type Octokit } from './github-api.js';

const repository = { owner: 'owner', repo: 'repo' };

/**
 * Creates a fake Octokit client.
 *
 * @param git - Mocked methods of `rest.git`.
 * @param pages - The result of `paginate`.
 * @returns The fake client.
 */
function fakeOctokit(git: Record<string, unknown> = {}, pages: unknown[] = []): Octokit {
  return {
    paginate: vi.fn().mockResolvedValue(pages),
    rest: {
      git: {
        getRef: git.getRef ?? vi.fn(),
        getTag: git.getTag ?? vi.fn(),
        listMatchingRefs: vi.fn(),
        createRef: git.createRef ?? vi.fn(),
        updateRef: git.updateRef ?? vi.fn(),
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

/**
 * Creates a response with a Git object.
 *
 * @param type - The object type.
 * @param sha - The object SHA.
 * @returns The response.
 */
function objectResponse(type: string, sha: string): { data: { object: { type: string; sha: string } } } {
  return { data: { object: { type, sha } } };
}

describe('getTagCommit', () => {
  it('returns the commit of a lightweight tag', async () => {
    const getRef = vi.fn().mockResolvedValue(objectResponse('commit', 'abc'));
    expect(await getTagCommit(fakeOctokit({ getRef }), repository, 'v1')).toBe('abc');
    expect(getRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'tags/v1' });
  });

  it('follows annotated tags to the commit', async () => {
    const getRef = vi.fn().mockResolvedValue(objectResponse('tag', 't1'));
    const getTag = vi
      .fn()
      .mockResolvedValueOnce(objectResponse('tag', 't2'))
      .mockResolvedValueOnce(objectResponse('commit', 'abc'));
    expect(await getTagCommit(fakeOctokit({ getRef, getTag }), repository, 'v1.0.0')).toBe('abc');
    expect(getTag).toHaveBeenNthCalledWith(1, { owner: 'owner', repo: 'repo', tag_sha: 't1' });
    expect(getTag).toHaveBeenNthCalledWith(2, { owner: 'owner', repo: 'repo', tag_sha: 't2' });
  });

  it('returns undefined for a missing tag', async () => {
    const getRef = vi.fn().mockRejectedValue(httpError(404));
    expect(await getTagCommit(fakeOctokit({ getRef }), repository, 'v1')).toBeUndefined();
  });

  it('rethrows other errors', async () => {
    const getRef = vi.fn().mockRejectedValue(httpError(500));
    await expect(getTagCommit(fakeOctokit({ getRef }), repository, 'v1')).rejects.toThrow('HTTP 500');
  });

  it('fails for a tag that does not point to a commit', async () => {
    const getRef = vi.fn().mockResolvedValue(objectResponse('tree', 'abc'));
    await expect(getTagCommit(fakeOctokit({ getRef }), repository, 'v1')).rejects.toThrow(
      'The tag "v1" does not point to a commit (found: tree).',
    );
  });

  it('stops following a chain of annotated tags that is too long', async () => {
    const getRef = vi.fn().mockResolvedValue(objectResponse('tag', 't'));
    const getTag = vi.fn().mockResolvedValue(objectResponse('tag', 't'));
    await expect(getTagCommit(fakeOctokit({ getRef, getTag }), repository, 'v1')).rejects.toThrow(
      'does not point to a commit (found: tag)',
    );
    expect(getTag).toHaveBeenCalledTimes(5);
  });
});

describe('listVersionTagNames', () => {
  it('lists the names of all tags starting with v', async () => {
    const octokit = fakeOctokit({}, [{ ref: 'refs/tags/v1' }, { ref: 'refs/tags/v1.0.0' }]);
    expect(await listVersionTagNames(octokit, repository)).toEqual(['v1', 'v1.0.0']);
    expect(octokit.paginate).toHaveBeenCalledWith(octokit.rest.git.listMatchingRefs, {
      owner: 'owner',
      repo: 'repo',
      ref: 'tags/v',
    });
  });
});

describe('writeTag', () => {
  it('creates a missing tag', async () => {
    const createRef = vi.fn();
    const updateRef = vi.fn();
    await writeTag(fakeOctokit({ createRef, updateRef }), repository, { tag: 'v1', sha: 'abc', exists: false });
    expect(createRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'refs/tags/v1', sha: 'abc' });
    expect(updateRef).not.toHaveBeenCalled();
  });

  it('moves an existing tag', async () => {
    const createRef = vi.fn();
    const updateRef = vi.fn();
    await writeTag(fakeOctokit({ createRef, updateRef }), repository, { tag: 'v1', sha: 'abc', exists: true });
    expect(updateRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'tags/v1', sha: 'abc', force: true });
    expect(createRef).not.toHaveBeenCalled();
  });
});
