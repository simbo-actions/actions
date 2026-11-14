import { summary } from '@actions/core';

import type { SettingChange } from './apply-repository-settings.types.js';

/**
 * Escapes text for the HTML of the job summary; setting names and values come
 * from the configuration and the API.
 *
 * @param text - The text.
 * @returns The escaped text.
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Formats a number of changes.
 *
 * @param count - The number.
 * @returns For example `1 change` or `3 changes`.
 */
export function changesCount(count: number): string {
  return `${count} change${count === 1 ? '' : 's'}`;
}

/**
 * Writes the changes to the job summary.
 *
 * @param changes - The applied changes, or the changes a dry run would apply.
 * @param params - The summary parameters.
 * @param params.repository - The repository, as `owner/repo`.
 * @param params.dryRun - Whether nothing was written.
 */
export async function writeSummary(
  changes: SettingChange[],
  params: { repository: string; dryRun: boolean },
): Promise<void> {
  const repository = `<code>${escapeHtml(params.repository)}</code>`;
  let status: string;
  if (changes.length === 0) {
    status = `✅ ${repository} already matches the configuration.`;
  } else if (params.dryRun) {
    status = `🧪 Dry run: ${changesCount(changes.length)} to ${repository} would be applied.`;
  } else {
    status = `✅ Applied ${changesCount(changes.length)} to ${repository}.`;
  }
  summary.addHeading('⚙️ Repository Settings', 2).addRaw(status, true);
  if (changes.length > 0) {
    summary.addTable([
      [
        { data: 'Setting', header: true },
        { data: 'Change', header: true },
      ],
      ...changes.map(({ setting, change }) => [`<code>${escapeHtml(setting)}</code>`, escapeHtml(change)]),
    ]);
  }
  await summary.write();
}
