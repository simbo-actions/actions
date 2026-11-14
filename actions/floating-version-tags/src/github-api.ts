import type { Octokit } from './create-octokit.js';
import { HTTP_STATUS_NOT_FOUND, MAX_TAG_DEPTH } from './floating-version-tags-constants.js';
import type { TagState } from './floating-version-tags.types.js';

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
 * Gets the commit a tag points to, following annotated tags.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @returns The commit SHA and the kind of the tag, or `undefined` if the tag does not exist.
 * @throws {Error} if the tag does not point to a commit.
 */
export async function getTagState(
  octokit: Octokit,
  repository: RepositoryRef,
  tag: string,
): Promise<TagState | undefined> {
  let object: { type: string; sha: string };
  let message: string | undefined;
  try {
    ({ object } = (await octokit.rest.git.getRef({ ...repository, ref: `tags/${tag}` })).data);
  } catch (error) {
    if (hasStatus(error, HTTP_STATUS_NOT_FOUND)) {
      return undefined;
    }
    throw error;
  }
  const annotated = object.type === 'tag';
  for (let depth = 0; object.type === 'tag' && depth < MAX_TAG_DEPTH; depth++) {
    const { data } = await octokit.rest.git.getTag({ ...repository, tag_sha: object.sha });
    message ??= data.message.replace(/\n+$/, '');
    ({ object } = data);
  }
  if (object.type !== 'commit') {
    throw new Error(`The tag "${tag}" does not point to a commit (found: ${object.type}).`);
  }
  return { commit: object.sha, annotated, ...(message !== undefined && { message }) };
}

/**
 * Lists the names of all tags that start with a prefix.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param prefix - The prefix, for example `v`; empty for all tags.
 * @returns The tag names.
 */
export async function listTagNames(octokit: Octokit, repository: RepositoryRef, prefix: string): Promise<string[]> {
  const refs = await octokit.paginate(octokit.rest.git.listMatchingRefs, {
    ...repository,
    ref: prefix ? `tags/${prefix}` : 'tags',
  });
  return refs.map(({ ref }) => ref.replace(/^refs\/tags\//, ''));
}

/**
 * Creates a tag or moves an existing one to a commit.
 *
 * With a message, the tag is an annotated tag object; GitHub does not sign it.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param params - The tag parameters.
 * @param params.tag - The tag name.
 * @param params.sha - The commit SHA.
 * @param params.exists - Whether the tag exists.
 * @param params.message - The message of an annotated tag, or `undefined` for a lightweight tag.
 */
export async function writeTag(
  octokit: Octokit,
  repository: RepositoryRef,
  params: { tag: string; sha: string; exists: boolean; message?: string },
): Promise<void> {
  const target =
    params.message === undefined
      ? params.sha
      : (
          await octokit.rest.git.createTag({
            ...repository,
            tag: params.tag,
            message: params.message,
            object: params.sha,
            type: 'commit',
          })
        ).data.sha;
  if (params.exists) {
    // Tags are not branches: moving one is always a forced update.
    await octokit.rest.git.updateRef({ ...repository, ref: `tags/${params.tag}`, sha: target, force: true });
  } else {
    await octokit.rest.git.createRef({ ...repository, ref: `refs/tags/${params.tag}`, sha: target });
  }
}
