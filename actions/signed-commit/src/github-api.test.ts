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
 * @param overrides.getRepo - The REST method to get a repository.
 * @returns The fake client.
 */
function fakeOctokit(
  overrides: { graphql?: unknown; createRef?: unknown; getRef?: unknown; getRepo?: unknown } = {},
): Octokit & { graphql: ReturnType<typeof vi.fn> } {
  return {
    graphql: overrides.graphql ?? vi.fn(),
    rest: {
      git: { createRef: overrides.createRef ?? vi.fn(), getRef: overrides.getRef ?? vi.fn() },
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

describe('createTag', () => {
  it('creates a lightweight tag', async () => {
    const createRef = vi.fn().mockResolvedValue({});
    const octokit = fakeOctokit({ createRef });
    expect(await createTag(octokit, repository, 'pkg/v1.0.0', sha)).toBe(true);
    expect(createRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'refs/tags/pkg/v1.0.0', sha });
  });

  it('accepts an existing tag on the same commit', async () => {
    const octokit = fakeOctokit({
      createRef: vi.fn().mockRejectedValue(httpError(422)),
      getRef: vi.fn().mockResolvedValue({ data: { object: { sha } } }),
    });
    expect(await createTag(octokit, repository, 'v1.0.0', sha)).toBe(false);
  });

  it('rejects an existing tag on another commit', async () => {
    const octokit = fakeOctokit({
      createRef: vi.fn().mockRejectedValue(httpError(422)),
      getRef: vi.fn().mockResolvedValue({ data: { object: { sha: 'c'.repeat(40) } } }),
    });
    await expect(createTag(octokit, repository, 'v1.0.0', sha)).rejects.toThrow('Failed to create tag "v1.0.0"');
  });

  it('rejects a tag that cannot be read', async () => {
    const octokit = fakeOctokit({
      createRef: vi.fn().mockRejectedValue(httpError(422)),
      getRef: vi.fn().mockRejectedValue(httpError(404)),
    });
    await expect(createTag(octokit, repository, 'v1.0.0', sha)).rejects.toThrow('Failed to create tag');
  });

  it('passes other errors through', async () => {
    const octokit = fakeOctokit({ createRef: vi.fn().mockRejectedValue(httpError(403)) });
    await expect(createTag(octokit, repository, 'v1.0.0', sha)).rejects.toThrow('HTTP 403');
  });
});
