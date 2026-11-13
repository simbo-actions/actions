import { info, setOutput } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import type { Version } from './floating-version-tags.types.js';
import { getTagCommit, listVersionTagNames, writeTag } from './github-api.js';
import { getFloatingTags, highestVersion, parseReleaseTag, parseVersionTag } from './version.js';

/**
 * Main entry point for the floating-version-tags action.
 *
 * Moves every enabled floating tag to the commit of the release tag, but only
 * if the release is the highest stable version of the tag's line. A floating
 * tag therefore only moves forward, and a re-run changes nothing.
 *
 * @throws {Error} if an input is invalid, the release tag does not exist, or an
 * API request fails.
 */
export async function main(): Promise<void> {
  const inputs = parseActionInputs();
  const release = parseReleaseTag(inputs.tag);
  const repository = { owner: inputs.owner, repo: inputs.repo };
  const octokit = createOctokit(inputs.token);

  const sha = await getTagCommit(octokit, repository, release.tag);
  if (sha === undefined) {
    throw new Error(`The tag "${release.tag}" does not exist in ${inputs.owner}/${inputs.repo}.`);
  }

  const versions = (await listVersionTagNames(octokit, repository))
    .map(name => parseVersionTag(name))
    .filter((version): version is Version => version !== undefined);

  const moved: string[] = [];
  for (const floating of getFloatingTags(release, inputs)) {
    const highest = highestVersion(
      release,
      versions.filter(version => floating.includes(version)),
    );
    if (highest.tag !== release.tag) {
      info(`Kept ${floating.name}: ${highest.tag} is newer than ${release.tag}.`);
      continue;
    }
    const current = await getTagCommit(octokit, repository, floating.name);
    if (current === sha) {
      info(`Kept ${floating.name}: it already points to ${release.tag} (${sha}).`);
      continue;
    }
    const exists = current !== undefined;
    const change = `${floating.name} ${exists ? 'to' : 'at'} ${release.tag} (${sha})`;
    if (inputs.dryRun) {
      info(`Would ${exists ? 'move' : 'create'} ${change}.`);
    } else {
      await writeTag(octokit, repository, { tag: floating.name, sha, exists });
      info(`${exists ? 'Moved' : 'Created'} ${change}.`);
    }
    moved.push(floating.name);
  }

  setOutput('moved', JSON.stringify(moved));
}
