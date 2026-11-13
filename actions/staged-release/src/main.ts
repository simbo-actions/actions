import { info, setOutput } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import { findAssets } from './find-assets.js';
import {
  assertTagExists,
  createDraftRelease,
  deleteRelease,
  listReleasesOfTag,
  publishRelease,
  uploadAsset,
} from './github-api.js';
import type { UploadedAsset } from './staged-release.types.js';

/**
 * Main entry point for the staged-release action.
 *
 * Creates the release as draft, uploads all assets, and publishes it only
 * when everything is complete.
 *
 * @throws {Error} if an input is invalid, the tag does not exist, the tag is
 * already released, an asset is missing, or an API request fails.
 */
export async function main(): Promise<void> {
  const inputs = await parseActionInputs();
  const { owner, repo, tag } = inputs;
  const repository = { owner, repo };
  const octokit = createOctokit(inputs.token);

  // Resolve assets first, so that a missing file fails before anything changes.
  const assets = await findAssets(inputs.assetPatterns, inputs.workingDirectory);
  await assertTagExists(octokit, repository, tag);

  const existing = await listReleasesOfTag(octokit, repository, tag);
  const released = existing.find(({ draft }) => !draft);
  if (released) {
    if (inputs.ifReleased === 'error') {
      throw new Error(`The tag "${tag}" is already released: ${released.html_url}`);
    }
    // A re-run after the release was published: nothing to do, the release is final.
    info(`Skipped: the tag "${tag}" is already released: ${released.html_url}`);
    setOutput('release-id', String(released.id));
    setOutput('url', released.html_url);
    setOutput('assets', '[]');
    return;
  }
  for (const { id } of existing) {
    await deleteRelease(octokit, repository, id);
    info(`Removed leftover draft release ${id} of ${tag}.`);
  }

  let release = await createDraftRelease(octokit, {
    repository,
    tag,
    name: inputs.name,
    body: inputs.body,
    prerelease: inputs.prerelease,
  });
  info(`Created draft release ${release.id} for ${tag}.`);

  const uploaded: UploadedAsset[] = [];
  for (const asset of assets) {
    uploaded.push(await uploadAsset(octokit, repository, release, asset));
    info(`Uploaded asset ${asset.name} (${asset.size} bytes).`);
  }

  if (inputs.publish) {
    release = await publishRelease(octokit, repository, release, inputs.makeLatest);
    info(`Published release ${release.html_url}`);
  } else {
    info(`Left release ${release.id} as draft (publish: false).`);
  }

  setOutput('release-id', String(release.id));
  setOutput('url', release.html_url);
  setOutput('assets', JSON.stringify(uploaded));
}
