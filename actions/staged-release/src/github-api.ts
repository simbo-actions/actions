import { readFile } from 'node:fs/promises';

import type { Octokit } from './create-octokit.js';
import {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
  RELEASES_PER_PAGE,
} from './staged-release-constants.js';
import type { AssetFile, MakeLatestOption, UploadedAsset } from './staged-release.types.js';

export type { Octokit } from './create-octokit.js';

/**
 * Identifies a repository on GitHub.
 */
export interface RepositoryRef {
  owner: string;
  repo: string;
}

/**
 * A release as returned by the GitHub API.
 */
export interface Release {
  id: number;
  tag_name: string;
  name?: string | null;
  draft: boolean;
  prerelease?: boolean;
  html_url: string;
  upload_url: string;
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
 * Ensures that a tag exists, so that creating a release never creates a tag implicitly.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @throws {Error} if the tag does not exist.
 */
export async function assertTagExists(octokit: Octokit, repository: RepositoryRef, tag: string): Promise<void> {
  try {
    await octokit.rest.git.getRef({ ...repository, ref: `tags/${tag}` });
  } catch (error) {
    if (hasStatus(error, HTTP_STATUS_NOT_FOUND)) {
      throw new Error(`The tag "${tag}" does not exist in ${repository.owner}/${repository.repo}.`, { cause: error });
    }
    throw error;
  }
}

/**
 * Lists the releases of a tag.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tag - The tag name.
 * @returns The releases of the tag, including drafts.
 */
export async function listReleasesOfTag(octokit: Octokit, repository: RepositoryRef, tag: string): Promise<Release[]> {
  const releases = (await octokit.paginate(octokit.rest.repos.listReleases, {
    ...repository,
    per_page: RELEASES_PER_PAGE,
  })) as Release[];
  return releases.filter(({ tag_name: tagName }) => tagName === tag);
}

/**
 * Deletes a release.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param releaseId - The release ID.
 */
export async function deleteRelease(octokit: Octokit, repository: RepositoryRef, releaseId: number): Promise<void> {
  await octokit.rest.repos.deleteRelease({ ...repository, release_id: releaseId });
}

/**
 * Creates a draft release for an existing tag.
 *
 * @param octokit - The Octokit client.
 * @param params - The release parameters.
 * @param params.repository - The repository.
 * @param params.tag - The tag name.
 * @param params.name - The release title.
 * @param params.body - The release notes.
 * @param params.prerelease - Whether the release is a prerelease.
 * @param params.generateReleaseNotes - Whether GitHub appends generated release notes to the body.
 * @param params.discussionCategory - The category of a discussion for the release, or an empty string for none.
 * @returns The draft release.
 * @throws {Error} if the discussion category does not exist, or the request fails.
 */
export async function createDraftRelease(
  octokit: Octokit,
  params: {
    repository: RepositoryRef;
    tag: string;
    name: string;
    body: string;
    prerelease: boolean;
    generateReleaseNotes: boolean;
    discussionCategory: string;
  },
): Promise<Release> {
  try {
    const { data } = await octokit.rest.repos.createRelease({
      ...params.repository,
      tag_name: params.tag,
      name: params.name,
      body: params.body,
      prerelease: params.prerelease,
      draft: true,
      ...(params.generateReleaseNotes && { generate_release_notes: true }),
      ...(params.discussionCategory && { discussion_category_name: params.discussionCategory }),
    });
    return data;
  } catch (error) {
    if (params.discussionCategory && hasStatus(error, HTTP_STATUS_UNPROCESSABLE_ENTITY)) {
      throw new Error(
        `Cannot create the release of "${params.tag}" with the discussion category "${params.discussionCategory}": check that discussions are enabled and the category exists.`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Uploads a file as asset of a release.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param release - The release.
 * @param asset - The file to upload.
 * @returns The uploaded asset.
 */
export async function uploadAsset(
  octokit: Octokit,
  repository: RepositoryRef,
  release: Release,
  asset: AssetFile,
): Promise<UploadedAsset> {
  const { data } = await octokit.rest.repos.uploadReleaseAsset({
    ...repository,
    release_id: release.id,
    name: asset.name,
    // The API accepts binary data; the types only describe strings.
    data: (await readFile(asset.path)) as unknown as string,
    // The client sets content-length from the data; setting it as well fails the request.
    headers: { 'content-type': 'application/octet-stream' },
  });
  return { name: data.name, size: data.size, url: data.browser_download_url };
}

/**
 * Publishes a draft release.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param release - The draft release.
 * @param makeLatest - Whether to mark the release as latest.
 * @returns The published release.
 */
export async function publishRelease(
  octokit: Octokit,
  repository: RepositoryRef,
  release: Release,
  makeLatest: MakeLatestOption,
): Promise<Release> {
  const { data } = await octokit.rest.repos.updateRelease({
    ...repository,
    release_id: release.id,
    draft: false,
    make_latest: makeLatest,
  });
  return data;
}
