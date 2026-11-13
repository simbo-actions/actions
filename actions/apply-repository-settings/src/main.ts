import { info, setOutput } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { applySettings } from './apply-settings.js';
import { createOctokit } from './create-octokit.js';
import { SettingsClient } from './settings-client.js';
import { changesCount, writeSummary } from './summary.js';

/**
 * Main entry point for the apply-repository-settings action.
 *
 * @throws {Error} if an input or the configuration is invalid, or an API request fails.
 */
export async function main(): Promise<void> {
  const { token, owner, repo, config, dryRun } = await parseActionInputs();
  const client = new SettingsClient(createOctokit(token), owner, repo, dryRun);

  await applySettings(client, config);

  const { changes } = client;
  setOutput('changed', String(changes.length > 0));
  setOutput('changes', JSON.stringify(changes));
  await writeSummary(changes, { repository: `${owner}/${repo}`, dryRun });

  if (changes.length === 0) {
    info(`All settings of ${owner}/${repo} are already applied.`);
  } else {
    info(`${dryRun ? 'Would apply' : 'Applied'} ${changesCount(changes.length)} to ${owner}/${repo}.`);
  }
}
