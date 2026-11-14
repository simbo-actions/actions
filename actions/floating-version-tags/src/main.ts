import { info, setOutput } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import type { FloatingTag, ParsedActionInputs, TagResult, Version } from './floating-version-tags.types.js';
import { getTagState, listTagNames, writeTag, type Octokit } from './github-api.js';
import { writeSummary } from './summary.js';
import {
  getFloatingTags,
  highestVersion,
  parseReleaseTag,
  parseVersionTag,
  tagMessage,
  versionPrefix,
} from './version.js';

/**
 * Verbs for the log, as done and as planned in a dry run.
 */
const VERBS: Record<TagResult['action'], [string, string]> = {
  created: ['Created', 'Would create'],
  moved: ['Moved', 'Would move'],
  replaced: ['Replaced', 'Would replace'],
  kept: ['Kept', 'Would keep'],
};

/**
 * Creates or moves one floating tag to the release, if the release is the
 * highest stable version of its line.
 *
 * @param octokit - The Octokit client.
 * @param inputs - The action inputs.
 * @param params - The tag parameters.
 * @param params.floating - The floating tag.
 * @param params.release - The released version.
 * @param params.sha - The commit of the release.
 * @param params.versions - All stable versions of the repository.
 * @returns What happened to the tag.
 */
async function updateFloatingTag(
  octokit: Octokit,
  inputs: ParsedActionInputs,
  params: { floating: FloatingTag; release: Version; sha: string; versions: Version[] },
): Promise<TagResult> {
  const { floating, release, sha } = params;
  const repository = { owner: inputs.owner, repo: inputs.repo };
  const highest = highestVersion(
    release,
    params.versions.filter(version => floating.includes(version)),
  );
  if (highest.tag !== release.tag) {
    return { name: floating.name, action: 'kept', reason: `${highest.tag} is newer` };
  }
  const current = await getTagState(octokit, repository, floating.name);
  const message = inputs.annotated ? tagMessage(floating, release) : undefined;
  // An annotated tag is kept only if its message names this release, which
  // differs if two release tags point to the same commit.
  if (current?.commit === sha && current.annotated === inputs.annotated && current.message === message) {
    return { name: floating.name, action: 'kept', reason: `already at ${release.tag}` };
  }
  const action = current === undefined ? 'created' : current.commit === sha ? 'replaced' : 'moved';
  const kind = inputs.annotated ? 'annotated' : 'lightweight';
  if (!inputs.dryRun) {
    await writeTag(octokit, repository, {
      tag: floating.name,
      sha,
      exists: current !== undefined,
      message,
    });
  }
  const reasons = {
    created: `at ${release.tag} (${kind})`,
    moved: `to ${release.tag} (${kind})`,
    replaced: `by ${inputs.annotated ? 'an' : 'a'} ${kind} tag at ${release.tag}`,
  };
  return { name: floating.name, action, reason: reasons[action] };
}

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
  const release = parseReleaseTag(inputs.tag, inputs.naming);
  const repository = { owner: inputs.owner, repo: inputs.repo };
  const fullName = `${inputs.owner}/${inputs.repo}`;
  const octokit = createOctokit(inputs.token);

  const releaseState = await getTagState(octokit, repository, release.tag);
  if (releaseState === undefined) {
    throw new Error(`The tag "${release.tag}" does not exist in ${fullName}. Create it before moving floating tags.`);
  }
  const sha = releaseState.commit;

  const versions = (await listTagNames(octokit, repository, versionPrefix(inputs.naming)))
    .map(name => parseVersionTag(name, inputs.naming))
    .filter((version): version is Version => version !== undefined);

  const results: TagResult[] = [];
  for (const floating of getFloatingTags(release, inputs)) {
    results.push(await updateFloatingTag(octokit, inputs, { floating, release, sha, versions }));
  }

  for (const { name, action, reason } of results) {
    const verb = VERBS[action][inputs.dryRun ? 1 : 0];
    info(action === 'kept' ? `${verb} ${name}: ${reason}.` : `${verb} ${name} ${reason}.`);
  }
  await writeSummary(results, { repository: fullName, release: release.tag, commit: sha, dryRun: inputs.dryRun });
  setOutput('moved', JSON.stringify(results.filter(({ action }) => action !== 'kept').map(({ name }) => name)));
}
