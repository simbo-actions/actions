import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { Core, GitHub } from './github-script.types.ts';
import { withRateLimitRetry } from './rate-limit.ts';

/**
 * A release of the GitHub API.
 */
interface Release {
  id: number;
  tag_name: string;
  draft: boolean;
  html_url: string;
  upload_url: string;
}

/**
 * Parameters of {@link publishRelease}.
 */
interface PublishParameters {
  github: GitHub;
  core: Core;
  owner: string;
  repo: string;
  tag: string;
  name: string;
  notesFile: string;
  assetsDirectory: string;
}

/**
 * Removes leftover drafts for the tag from a previous failed run.
 *
 * @param parameters - The parameters.
 * @throws {Error} if a published release for the tag exists.
 */
async function removeDrafts(parameters: PublishParameters): Promise<void> {
  const { github, core, owner, repo, tag } = parameters;
  const releases = await withRateLimitRetry(core, 'reading releases', async () =>
    github.paginate<Release>('GET /repos/{owner}/{repo}/releases', { owner, repo, per_page: 100 }),
  );
  const releasesOfTag = releases.filter(({ tag_name: tagName }) => tagName === tag);
  for (const release of releasesOfTag) {
    if (!release.draft) {
      throw new Error(`A published release for ${tag} already exists: ${release.html_url}`);
    }
    await withRateLimitRetry(core, `removing draft release ${release.id}`, async () =>
      github.request('DELETE /repos/{owner}/{repo}/releases/{release_id}', { owner, repo, release_id: release.id }),
    );
    core.info(`Removed leftover draft release ${release.id}.`);
  }
}

/**
 * Creates a GitHub release for an existing tag: first as draft, then uploads
 * the assets, then publishes it. This order also works with immutable
 * releases, which reject asset uploads after publishing.
 *
 * @param parameters - The parameters.
 * @throws {Error} if a published release for the tag exists or a request fails.
 */
export async function publishRelease(parameters: PublishParameters): Promise<void> {
  const { github, core, owner, repo, tag, name, notesFile, assetsDirectory } = parameters;

  await removeDrafts(parameters);

  const body = await readFile(notesFile, 'utf8');
  const { data: draft } = await withRateLimitRetry(core, 'creating the draft release', async () =>
    github.request<Release>('POST /repos/{owner}/{repo}/releases', {
      owner,
      repo,
      tag_name: tag,
      name,
      body,
      draft: true,
    }),
  );
  core.info(`Created draft release ${draft.id}.`);

  const files = (await readdir(assetsDirectory)).toSorted((a, b) => a.localeCompare(b));
  for (const file of files) {
    const path = join(assetsDirectory, file);
    const { size } = await stat(path);
    const data = await readFile(path);
    await withRateLimitRetry(core, `uploading asset ${file}`, async () =>
      github.request({
        method: 'POST',
        url: draft.upload_url,
        name: file,
        headers: { 'content-type': 'application/octet-stream', 'content-length': size },
        data,
      }),
    );
    core.info(`Uploaded asset ${file}.`);
  }

  const { data: release } = await withRateLimitRetry(core, 'publishing the release', async () =>
    github.request<Release>('PATCH /repos/{owner}/{repo}/releases/{release_id}', {
      owner,
      repo,
      release_id: draft.id,
      draft: false,
      make_latest: 'true',
    }),
  );
  core.info(`Published release ${release.html_url}`);
  core.setOutput('url', release.html_url);
}
