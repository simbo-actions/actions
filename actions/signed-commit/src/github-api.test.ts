import { describe, expect, it, vi } from 'vitest';

import {
  createBranch,
  createCommitOnBranch,
  createTag,
  getBranchHeadOid,
  getDefaultBranch,
  type Octokit,
} from './github-api.js';

const repository = { owner: 'owner', repo: 'repo' };
const sha = 'a'.repeat(40);

/**
 * Creates a fake Octokit client.
 *
 * @param overrides - Implementations of the used methods.
 * @param overrides.graphql - The GraphQL method.
 * @param overrides.createRef - The REST method to create a reference.
 * @param overrides.getRef - The REST method to get a reference.
 * @param overrides.createTag - The REST method to create a tag object.
 * @param overrides.getTag - The REST method to get a tag object.
 * @param overrides.getRepo - The REST method to get a repository.
 * @returns The fake client.
 */
function fakeOctokit(
  overrides: {
    graphql?: unknown;
    createRef?: unknown;
    getRef?: unknown;
    createTag?: unknown;
    getTag?: unknown;
    getRepo?: unknown;
  } = {},
): Octokit & { graphql: ReturnType<typeof vi.fn> } {
  return {
    graphql: overrides.graphql ?? vi.fn(),
    rest: {
      git: {
        createRef: overrides.createRef ?? vi.fn(),
        getRef: overrides.getRef ?? vi.fn(),
        createTag: overrides.createTag ?? vi.fn(),
        getTag: overrides.getTag ?? vi.fn(),
      },
      repos: { get: overrides.getRepo ?? vi.fn() },
    },
  } as unknown as Octokit & { graphql: ReturnType<typeof vi.fn> };
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

describe('getBranchHeadOid', () => {
  it('returns the head object ID', async () => {
    const octokit = fakeOctokit({
      graphql: vi.fn().mockResolvedValue({ repository: { ref: { target: { oid: sha } } } }),
    });
    expect(await getBranchHeadOid(octokit, repository, 'main')).toBe(sha);
    expect(octokit.graphql).toHaveBeenCalledWith(expect.any(String), {
      owner: 'owner',
      repo: 'repo',
      qualifiedRef: 'refs/heads/main',
    });
  });

  it('returns undefined for a missing branch', async () => {
    const octokit = fakeOctokit({ graphql: vi.fn().mockResolvedValue({ repository: { ref: null } }) });
    expect(await getBranchHeadOid(octokit, repository, 'missing')).toBeUndefined();
  });

  it('throws for a missing repository', async () => {
    const octokit = fakeOctokit({ graphql: vi.fn().mockResolvedValue({ repository: null }) });
    await expect(getBranchHeadOid(octokit, repository, 'main')).rejects.toThrow('Repository not found');
  });
});

describe('createCommitOnBranch', () => {
  it('sends the mutation and returns the commit object ID', async () => {
    const octokit = fakeOctokit({
      graphql: vi.fn().mockResolvedValue({ createCommitOnBranch: { commit: { oid: 'b'.repeat(40) } } }),
    });
    const fileChanges = { additions: [{ path: 'a.txt', contents: 'YQ==' }], deletions: [{ path: 'b.txt' }] };

    const oid = await createCommitOnBranch(octokit, {
      repository,
      branch: 'main',
      expectedHeadOid: sha,
      message: { headline: 'feat: x', body: 'body' },
      fileChanges,
    });

    expect(oid).toBe('b'.repeat(40));
    expect(octokit.graphql).toHaveBeenCalledWith(expect.stringContaining('createCommitOnBranch'), {
      input: {
        branch: { repositoryNameWithOwner: 'owner/repo', branchName: 'main' },
        expectedHeadOid: sha,
        message: { headline: 'feat: x', body: 'body' },
        fileChanges,
      },
    });
  });
});

describe('getDefaultBranch', () => {
  it('returns the default branch', async () => {
    const getRepo = vi.fn().mockResolvedValue({ data: { default_branch: 'trunk' } });
    expect(await getDefaultBranch(fakeOctokit({ getRepo }), repository)).toBe('trunk');
    expect(getRepo).toHaveBeenCalledWith(repository);
  });
});

describe('createBranch', () => {
  it('creates the branch at the commit', async () => {
    const createRef = vi.fn();
    await createBranch(fakeOctokit({ createRef }), repository, 'feature', sha);
    expect(createRef).toHaveBeenCalledWith({ ...repository, ref: 'refs/heads/feature', sha });
  });

  it('explains a rejected branch', async () => {
    const createRef = vi.fn().mockRejectedValue(httpError(422));
    await expect(createBranch(fakeOctokit({ createRef }), repository, 'feature', sha)).rejects.toThrow(
      `Failed to create the branch "feature" at ${sha}: it was created meanwhile`,
    );
  });

  it('rethrows other errors', async () => {
    const createRef = vi.fn().mockRejectedValue(httpError(403));
    await expect(createBranch(fakeOctokit({ createRef }), repository, 'feature', sha)).rejects.toThrow('HTTP 403');
  });
});

const tagSha = 'd'.repeat(40);
const otherSha = 'c'.repeat(40);
const annotated = { type: 'annotated', message: 'Release pkg/v1.0.0' } as const;
const lightweight = { type: 'lightweight', message: 'pkg/v1.0.0' } as const;

/**
 * Fakes `getRef` for a lightweight tag.
 *
 * @param target - The commit the tag points to.
 * @returns The fake method.
 */
function lightweightRef(target: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ data: { object: { sha: target, type: 'commit' } } });
}

/**
 * Fakes `getRef` and `getTag` for an annotated tag.
 *
 * @param target - The commit the tag object points to.
 * @returns The fake methods.
 */
function annotatedRef(target: string): { getRef: ReturnType<typeof vi.fn>; getTag: ReturnType<typeof vi.fn> } {
  return {
    getRef: vi.fn().mockResolvedValue({ data: { object: { sha: tagSha, type: 'tag' } } }),
    getTag: vi.fn().mockResolvedValue({ data: { object: { sha: target, type: 'commit' } } }),
  };
}

const missingRef = (): ReturnType<typeof vi.fn> => vi.fn().mockRejectedValue(httpError(404));

describe('createTag', () => {
  it('creates an annotated tag object and a reference to it', async () => {
    const createTagObject = vi.fn().mockResolvedValue({ data: { sha: tagSha } });
    const createRef = vi.fn().mockResolvedValue({});
    const octokit = fakeOctokit({ getRef: missingRef(), createTag: createTagObject, createRef });

    expect(await createTag(octokit, repository, 'pkg/v1.0.0', sha, annotated)).toBe(true);
    expect(createTagObject).toHaveBeenCalledWith({
      ...repository,
      tag: 'pkg/v1.0.0',
      message: 'Release pkg/v1.0.0',
      object: sha,
      type: 'commit',
    });
    expect(createRef).toHaveBeenCalledWith({ ...repository, ref: 'refs/tags/pkg/v1.0.0', sha: tagSha });
  });

  it('creates a lightweight tag', async () => {
    const createTagObject = vi.fn();
    const createRef = vi.fn().mockResolvedValue({});
    const octokit = fakeOctokit({ getRef: missingRef(), createTag: createTagObject, createRef });

    expect(await createTag(octokit, repository, 'pkg/v1.0.0', sha, lightweight)).toBe(true);
    expect(createTagObject).not.toHaveBeenCalled();
    expect(createRef).toHaveBeenCalledWith({ ...repository, ref: 'refs/tags/pkg/v1.0.0', sha });
  });

  it.each([
    ['annotated', annotated, annotatedRef(sha)],
    ['lightweight', lightweight, { getRef: lightweightRef(sha) }],
  ] as const)('accepts an existing %s tag on the same commit without creating objects', async (_, options, fakes) => {
    const createTagObject = vi.fn();
    const createRef = vi.fn();
    const octokit = fakeOctokit({ ...fakes, createTag: createTagObject, createRef });

    expect(await createTag(octokit, repository, 'pkg/v1.0.0', sha, options)).toBe(false);
    expect(createTagObject).not.toHaveBeenCalled();
    expect(createRef).not.toHaveBeenCalled();
  });

  it.each([
    ['annotated', annotated, annotatedRef(otherSha)],
    ['lightweight', lightweight, { getRef: lightweightRef(otherSha) }],
  ] as const)('rejects an existing %s tag on another commit', async (_, options, fakes) => {
    const octokit = fakeOctokit(fakes);
    await expect(createTag(octokit, repository, 'v1.0.0', sha, options)).rejects.toThrow(
      `Failed to create tag "v1.0.0": it already exists on ${otherSha}, not on ${sha}.`,
    );
  });

  it('rejects an existing lightweight tag where an annotated tag is requested', async () => {
    const createTagObject = vi.fn();
    const octokit = fakeOctokit({ getRef: lightweightRef(sha), createTag: createTagObject });
    await expect(createTag(octokit, repository, 'v1.0.0', sha, annotated)).rejects.toThrow(
      `Failed to create tag "v1.0.0": it already exists on ${sha} as lightweight tag, not as annotated tag.`,
    );
    expect(createTagObject).not.toHaveBeenCalled();
  });

  it('rejects an existing annotated tag where a lightweight tag is requested', async () => {
    const octokit = fakeOctokit(annotatedRef(sha));
    await expect(createTag(octokit, repository, 'v1.0.0', sha, lightweight)).rejects.toThrow(
      'as annotated tag, not as lightweight tag.',
    );
  });

  it('accepts a tag created meanwhile by a concurrent run', async () => {
    const getRef = vi
      .fn()
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce({ data: { object: { sha: tagSha, type: 'tag' } } });
    const octokit = fakeOctokit({
      getRef,
      getTag: vi.fn().mockResolvedValue({ data: { object: { sha, type: 'commit' } } }),
      createTag: vi.fn().mockResolvedValue({ data: { sha: 'e'.repeat(40) } }),
      createRef: vi.fn().mockRejectedValue(httpError(422)),
    });
    expect(await createTag(octokit, repository, 'v1.0.0', sha, annotated)).toBe(false);
  });

  it('rejects a tag created meanwhile on another commit', async () => {
    const getRef = vi
      .fn()
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce({ data: { object: { sha: otherSha, type: 'commit' } } });
    const octokit = fakeOctokit({ getRef, createRef: vi.fn().mockRejectedValue(httpError(422)) });
    await expect(createTag(octokit, repository, 'v1.0.0', sha, lightweight)).rejects.toThrow(
      `it already exists on ${otherSha}`,
    );
  });

  it('explains a reference that cannot be created', async () => {
    const octokit = fakeOctokit({ getRef: missingRef(), createRef: vi.fn().mockRejectedValue(httpError(422)) });
    await expect(createTag(octokit, repository, 'v1.0.0', sha, lightweight)).rejects.toThrow(
      'Failed to create tag "v1.0.0": it already exists or is not allowed.',
    );
  });

  it('passes other errors of reading the tag through', async () => {
    const octokit = fakeOctokit({ getRef: vi.fn().mockRejectedValue(httpError(403)) });
    await expect(createTag(octokit, repository, 'v1.0.0', sha, annotated)).rejects.toThrow('HTTP 403');
  });

  it('passes other errors of creating the reference through', async () => {
    const octokit = fakeOctokit({ getRef: missingRef(), createRef: vi.fn().mockRejectedValue(httpError(403)) });
    await expect(createTag(octokit, repository, 'v1.0.0', sha, lightweight)).rejects.toThrow('HTTP 403');
  });
});
