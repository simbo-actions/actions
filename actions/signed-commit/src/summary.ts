import { summary } from '@actions/core';

import type { BranchHead, CommitMessage, FileChanges } from './signed-commit.types.js';

/**
 * Length of an abbreviated commit SHA in the job summary.
 */
const SHORT_SHA_LENGTH = 7;

/**
 * Maximum number of paths listed in the job summary.
 */
const MAX_LISTED_PATHS = 50;

/**
 * Escapes text for the HTML of the job summary; commit messages and paths
 * come from the workflow.
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
 * Formats the changed files as collapsible list.
 *
 * @param fileChanges - The file changes.
 * @returns The HTML.
 */
function filesDetails(fileChanges: FileChanges): string {
  const paths = [
    ...fileChanges.additions.map(({ path }) => `+ ${path}`),
    ...fileChanges.deletions.map(({ path }) => `- ${path}`),
  ];
  const listed = paths.slice(0, MAX_LISTED_PATHS).map(path => escapeHtml(path));
  if (paths.length > MAX_LISTED_PATHS) {
    listed.push(`… and ${paths.length - MAX_LISTED_PATHS} more`);
  }
  const count = `${fileChanges.additions.length} added or changed, ${fileChanges.deletions.length} deleted`;
  return `<details><summary>Files: ${count}</summary><pre>${listed.join('\n')}</pre></details>`;
}

/**
 * Writes the result to the job summary: the commit or why there is none, the
 * branch, the tags, and the files.
 *
 * @param params - The summary parameters.
 * @param params.repository - The repository, as `owner/repo`.
 * @param params.branch - The branch.
 * @param params.head - The head the commit is based on, and where a new branch started.
 * @param params.message - The commit message.
 * @param params.commitOid - The new commit, or `undefined` if there was nothing to commit.
 * @param params.commitUrl - The URL of the new commit.
 * @param params.tags - The tags, and whether each was created or already existed.
 * @param params.fileChanges - The committed files.
 */
export async function writeSummary(params: {
  repository: string;
  branch: string;
  head: BranchHead;
  message: CommitMessage;
  commitOid?: string;
  commitUrl: string;
  tags: { name: string; created: boolean }[];
  fileChanges: FileChanges;
}): Promise<void> {
  const target = `<code>${escapeHtml(params.repository)}@${escapeHtml(params.branch)}</code>`;
  const branchOrigin = params.head.createdFrom
    ? ` (new branch from <code>${escapeHtml(params.head.createdFrom)}</code>)`
    : '';
  summary.addHeading('✍️ Signed Commit', 2);
  if (params.commitOid) {
    summary
      .addRaw(
        `✅ Verified commit <a href="${params.commitUrl}"><code>${params.commitOid.slice(0, SHORT_SHA_LENGTH)}</code></a> on ${target}${branchOrigin}`,
        true,
      )
      .addRaw(`<blockquote>${escapeHtml(params.message.headline)}</blockquote>`, true);
  } else {
    summary.addRaw(
      `ℹ️ Nothing to commit on ${target}${branchOrigin} at <code>${params.head.oid.slice(0, SHORT_SHA_LENGTH)}</code>.`,
      true,
    );
  }
  if (params.tags.length > 0) {
    const tags = params.tags.map(
      ({ name, created }) => `<code>${escapeHtml(name)}</code>${created ? '' : ' (existed)'}`,
    );
    summary.addRaw(`🏷️ Tags: ${tags.join(', ')}`, true);
  }
  if (params.commitOid) {
    summary.addRaw(filesDetails(params.fileChanges), true);
  }
  await summary.write();
}
