//------------------------------------------------------------------------------
// Publish Release
//
// Creates a GitHub release for an existing tag: first as draft, then uploads
// the assets, then publishes it. This order also works with immutable
// releases, which reject asset uploads after publishing.
//------------------------------------------------------------------------------

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Removes leftover drafts for the tag from a previous failed run.
 *
 * @param {object} params - The parameters.
 * @param {import('@octokit/core').Octokit & { paginate: Function }} params.github - The Octokit client.
 * @param {object} params.core - The `@actions/core` module.
 * @param {string} params.owner - The repository owner.
 * @param {string} params.repo - The repository name.
 * @param {string} params.tag - The tag name.
 * @throws {Error} if a published release for the tag exists.
 */
async function removeDrafts({ github, core, owner, repo, tag }) {
  const releases = await github.paginate('GET /repos/{owner}/{repo}/releases', { owner, repo, per_page: 100 });
  for (const release of releases.filter(({ tag_name }) => tag_name === tag)) {
    if (!release.draft) {
      throw new Error(`A published release for ${tag} already exists: ${release.html_url}`);
    }
    await github.request('DELETE /repos/{owner}/{repo}/releases/{release_id}', {
      owner,
      repo,
      release_id: release.id,
    });
    core.info(`Removed leftover draft release ${release.id}.`);
  }
}

/**
 * Creates and publishes a release with assets.
 *
 * @param {object} params - The parameters.
 * @param {import('@octokit/core').Octokit & { paginate: Function }} params.github - The Octokit client with contents permission.
 * @param {object} params.core - The `@actions/core` module.
 * @param {string} params.owner - The repository owner.
 * @param {string} params.repo - The repository name.
 * @param {string} params.tag - The existing tag to release.
 * @param {string} params.name - The release title.
 * @param {string} params.notesFile - Path to the release notes (Markdown).
 * @param {string} params.assetsDirectory - Directory with the files to upload as assets.
 */
export async function publishRelease({ github, core, owner, repo, tag, name, notesFile, assetsDirectory }) {
  await removeDrafts({ github, core, owner, repo, tag });

  const { data: draft } = await github.request('POST /repos/{owner}/{repo}/releases', {
    owner,
    repo,
    tag_name: tag,
    name,
    body: await readFile(notesFile, 'utf8'),
    draft: true,
  });
  core.info(`Created draft release ${draft.id}.`);

  const files = (await readdir(assetsDirectory)).toSorted();
  for (const file of files) {
    const path = join(assetsDirectory, file);
    await github.request({
      method: 'POST',
      url: draft.upload_url,
      name: file,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': (await stat(path)).size,
      },
      data: await readFile(path),
    });
    core.info(`Uploaded asset ${file}.`);
  }

  const { data: release } = await github.request('PATCH /repos/{owner}/{repo}/releases/{release_id}', {
    owner,
    repo,
    release_id: draft.id,
    draft: false,
    make_latest: 'true',
  });
  core.info(`Published release ${release.html_url}`);
  core.setOutput('url', release.html_url);
}
