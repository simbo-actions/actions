import type { getOctokit } from '@actions/github';

import { withRateLimitRetry } from './rate-limit.js';
import { HTTP_STATUS_UNPROCESSABLE_ENTITY } from './signed-commit-constants.js';
import type { CommitMessage, FileChanges } from './signed-commit.types.js';

/**
 * An authenticated Octokit client.
 */
export type Octokit = ReturnType<typeof getOctokit>;

/**
 * Identifies a repository on GitHub.
 */
export interface RepositoryRef {
  owner: string;
  repo: string;
}

/**
 * Checks whether an error is an HTTP error with the given status.
 *
 * @param error - The error to check.
 * @param status - The expected HTTP status.
 * @returns `true` if the error has the given status.
 */
function hasStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

/**
 * Returns the object ID of the head commit of a branch.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param branch - The branch name.
 * @returns The object ID, or `undefined` if the branch does not exist.
 * @throws {Error} if the repository does not exist or is not accessible.
 */
export async function getBranchHeadOid(
  octokit: Octokit,
  repository: RepositoryRef,
  branch: string,
): Promise<string | undefined> {
  const query = `
    query ($owner: String!, $repo: String!, $qualifiedRef: String!) {
      repository(owner: $owner, name: $repo) {
        ref(qualifiedName: $qualifiedRef) {
          target { oid }
        }
      }
    }
  `;

  const result = await withRateLimitRetry('reading the branch head', async () =>
    octokit.graphql<{ repository: { ref: { target: { oid: string } } | null } | null }>(query, {
      owner: repository.owner,
      repo: repository.repo,
      qualifiedRef: `refs/heads/${branch}`,
    }),
  );

  if (!result.repository) {
    throw new Error(`Repository not found or not accessible: ${repository.owner}/${repository.repo}`);
  }

  return result.repository.ref?.target.oid;
}

/**
 * Creates a commit on a branch via the GraphQL mutation `createCommitOnBranch`.
 * GitHub signs the commit, so it is shown as verified.
 *
 * @param octokit - The Octokit client.
 * @param params - The commit parameters.
 * @param params.repository - The repository.
 * @param params.branch - The branch name.
 * @param params.expectedHeadOid - The object ID the branch head must have.
 * @param params.message - The commit message.
 * @param params.fileChanges - The file additions and deletions.
 * @returns The object ID of the created commit.
 */
export async function createCommitOnBranch(
  octokit: Octokit,
  params: {
    repository: RepositoryRef;
    branch: string;
    expectedHeadOid: string;
    message: CommitMessage;
    fileChanges: FileChanges;
  },
): Promise<string> {
  const mutation = `
    mutation ($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit { oid }
      }
    }
  `;

  const result = await withRateLimitRetry('creating the commit', async () =>
    octokit.graphql<{ createCommitOnBranch: { commit: { oid: string } } }>(mutation, {
      input: {
        branch: {
          repositoryNameWithOwner: `${params.repository.owner}/${params.repository.repo}`,
          branchName: params.branch,
        },
        expectedHeadOid: params.expectedHeadOid,
        message: params.message,
        fileChanges: params.fileChanges,
      },
    }),
  );

  return result.createCommitOnBranch.commit.oid;
}

/**
 * Returns the object ID a tag points to.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @returns The object ID, or `undefined` if the tag does not exist.
 */
async function getTagSha(octokit: Octokit, repository: RepositoryRef, tag: string): Promise<string | undefined> {
  try {
    const { data } = await withRateLimitRetry(`reading the tag ${tag}`, async () =>
      octokit.rest.git.getRef({ ...repository, ref: `tags/${tag}` }),
    );
    return data.object.sha;
  } catch {
    return;
  }
}

/**
 * Creates a lightweight tag pointing to a commit.
 * An existing tag pointing to the same commit is accepted.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @param sha - The commit object ID.
 * @returns `true` if the tag was created, `false` if it already pointed to the commit.
 * @throws {Error} if the tag exists and points to another object.
 */
export async function createTag(
  octokit: Octokit,
  repository: RepositoryRef,
  tag: string,
  sha: string,
): Promise<boolean> {
  try {
    await withRateLimitRetry(`creating the tag ${tag}`, async () =>
      octokit.rest.git.createRef({ ...repository, ref: `refs/tags/${tag}`, sha }),
    );
    return true;
  } catch (error) {
    if (!hasStatus(error, HTTP_STATUS_UNPROCESSABLE_ENTITY)) {
      throw error;
    }
    if ((await getTagSha(octokit, repository, tag)) === sha) {
      return false;
    }
    throw new Error(`Failed to create tag "${tag}": it already exists or is not allowed.`, { cause: error });
  }
}
