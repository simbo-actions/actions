import { summary } from '@actions/core';

import type { TagResult } from './floating-version-tags.types.js';

/**
 * Length of an abbreviated commit SHA in the job summary.
 */
const SHORT_SHA_LENGTH = 7;

/**
 * Labels of the results, as done and as planned in a dry run.
 */
const LABELS: Record<TagResult['action'], [string, string]> = {
  created: ['✅ created', '🧪 would create'],
  moved: ['✅ moved', '🧪 would move'],
  replaced: ['✅ replaced', '🧪 would replace'],
  kept: ['⏸️ kept', '⏸️ would keep'],
};

/**
 * Writes the results to the job summary: the release, and one row per
 * floating tag.
 *
 * @param results - The result of every floating tag.
 * @param params - The summary parameters.
 * @param params.repository - The repository, as `owner/repo`.
 * @param params.release - The release tag.
 * @param params.commit - The commit of the release tag.
 * @param params.dryRun - Whether nothing was written.
 */
export async function writeSummary(
  results: TagResult[],
  params: { repository: string; release: string; commit: string; dryRun: boolean },
): Promise<void> {
  const changed = results.filter(({ action }) => action !== 'kept').length;
  const count = `${changed} of ${results.length} floating ${results.length === 1 ? 'tag' : 'tags'}`;
  const status = params.dryRun
    ? `🧪 Dry run: ${count} would change.`
    : `${changed > 0 ? '✅' : 'ℹ️'} ${count} changed.`;
  await summary
    .addHeading('🏷️ Floating Version Tags', 2)
    .addRaw(status, true)
    .addRaw(
      `<code>${params.repository}</code> · release <code>${params.release}</code> at <code>${params.commit.slice(0, SHORT_SHA_LENGTH)}</code>`,
      true,
    )
    .addTable([
      [
        { data: 'Tag', header: true },
        { data: 'Result', header: true },
        { data: 'Details', header: true },
      ],
      ...results.map(({ name, action, reason }) => [
        `<code>${name}</code>`,
        LABELS[action][params.dryRun ? 1 : 0],
        reason,
      ]),
    ])
    .write();
}
