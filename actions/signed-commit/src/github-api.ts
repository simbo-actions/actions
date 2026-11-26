import type { Octokit } from './create-octokit.js';
import { HTTP_STATUS_NOT_FOUND, HTTP_STATUS_UNPROCESSABLE_ENTITY } from './signed-commit-constants.js';
import type { CommitMessage, FileChanges, TagOptions, TagType } from './signed-commit.types.js';

export type { Octokit } from './create-octokit.js';

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

  const result = await octokit.graphql<{ repository: { ref: { target: { oid: string } } | null } | null }>(query, {
    owner: repository.owner,
    repo: repository.repo,
    qualifiedRef: `refs/heads/${branch}`,
  });

  if (!result.repository) {
    throw new Error(`Repository not found or not accessible: ${repository.owner}/${repository.repo}`);
  }

  return result.repository.ref?.target.oid;
}

/**
 * Returns the default branch of a repository.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @returns The branch name.
 */
export async function getDefaultBranch(octokit: Octokit, repository: RepositoryRef): Promise<string> {
  return (await octokit.rest.repos.get({ ...repository })).data.default_branch;
}

/**
 * Creates a branch pointing to a commit.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param branch - The branch name.
 * @param sha - The commit object ID.
 * @throws {Error} if the branch exists meanwhile or the commit does not exist.
 */
export async function createBranch(
  octokit: Octokit,
  repository: RepositoryRef,
  branch: string,
  sha: string,
): Promise<void> {
  try {
    await octokit.rest.git.createRef({ ...repository, ref: `refs/heads/${branch}`, sha });
  } catch (error) {
    if (!hasStatus(error, HTTP_STATUS_UNPROCESSABLE_ENTITY)) {
      throw error;
    }
    throw new Error(
      `Failed to create the branch "${branch}" at ${sha}: it was created meanwhile, the commit does not exist, or a ruleset forbids it. Re-run to commit to the existing branch.`,
      { cause: error },
    );
  }
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

  const result = await octokit.graphql<{ createCommitOnBranch: { commit: { oid: string } } }>(mutation, {
    input: {
      branch: {
        repositoryNameWithOwner: `${params.repository.owner}/${params.repository.repo}`,
        branchName: params.branch,
      },
      expectedHeadOid: params.expectedHeadOid,
      message: params.message,
      fileChanges: params.fileChanges,
    },
  });

  return result.createCommitOnBranch.commit.oid;
}

/**
 * Describes an existing tag: its type and the commit it points to.
 */
interface ExistingTag {
  type: TagType;

  /**
   * The object the tag points to, after resolving an annotated tag object.
   */
  sha: string;
}

/**
 * Returns the type of an existing tag and the object it points to.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @returns The existing tag, or `undefined` if the tag does not exist.
 */
async function getExistingTag(
  octokit: Octokit,
  repository: RepositoryRef,
  tag: string,
): Promise<ExistingTag | undefined> {
  let object: { sha: string; type: string };
  try {
    ({ object } = (await octokit.rest.git.getRef({ ...repository, ref: `tags/${tag}` })).data);
  } catch (error) {
    if (hasStatus(error, HTTP_STATUS_NOT_FOUND)) {
      return;
    }
    throw error;
  }
  if (object.type !== 'tag') {
    return { type: 'lightweight', sha: object.sha };
  }
  const { data } = await octokit.rest.git.getTag({ ...repository, tag_sha: object.sha });
  return { type: 'annotated', sha: data.object.sha };
}

/**
 * Accepts an existing tag only if it has the requested type and points to the commit.
 *
 * @param tag - The tag name.
 * @param existing - The existing tag.
 * @param options - The requested tag.
 * @param sha - The commit object ID.
 * @throws {Error} if the tag has another type or points to another object.
 */
function assertSameTag(tag: string, existing: ExistingTag, options: TagOptions, sha: string): void {
  if (existing.sha !== sha) {
    throw new Error(`Failed to create tag "${tag}": it already exists on ${existing.sha}, not on ${sha}.`);
  }
  if (existing.type !== options.type) {
    throw new Error(
      `Failed to create tag "${tag}": it already exists on ${sha} as ${existing.type} tag, not as ${options.type} tag.`,
    );
  }
}

/**
 * Creates a tag pointing to a commit: an annotated tag object with the
 * identity of the token as tagger, or a lightweight tag. GitHub does not sign
 * tag objects created via the API.
 *
 * An existing tag of the same type on the same commit is accepted, so a re-run
 * completes the tags of an interrupted run. Its tagger and message are not
 * compared. If the reference cannot be created after the tag object, the tag
 * object stays unreferenced and is harmless.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @param sha - The commit object ID.
 * @param options - The type and message of the tag.
 * @returns `true` if the tag was created, `false` if it already existed.
 * @throws {Error} if the tag exists with another type or on another object, or cannot be created.
 */
export async function createTag(
  octokit: Octokit,
  repository: RepositoryRef,
  tag: string,
  sha: string,
  options: TagOptions,
): Promise<boolean> {
  const existing = await getExistingTag(octokit, repository, tag);
  if (existing) {
    assertSameTag(tag, existing, options, sha);
    return false;
  }

  let refSha = sha;
  if (options.type === 'annotated') {
    const { data } = await octokit.rest.git.createTag({
      ...repository,
      tag,
      message: options.message,
      object: sha,
      type: 'commit',
    });
    refSha = data.sha;
  }

  try {
    await octokit.rest.git.createRef({ ...repository, ref: `refs/tags/${tag}`, sha: refSha });
    return true;
  } catch (error) {
    if (!hasStatus(error, HTTP_STATUS_UNPROCESSABLE_ENTITY)) {
      throw error;
    }
    // The tag was created meanwhile, or a ruleset forbids it.
    let created: ExistingTag | undefined;
    try {
      created = await getExistingTag(octokit, repository, tag);
    } catch {
      // Reported below with the error of creating the reference.
    }
    if (!created) {
      throw new Error(`Failed to create tag "${tag}": it already exists or is not allowed.`, { cause: error });
    }
    assertSameTag(tag, created, options, sha);
    return false;
  }
}
