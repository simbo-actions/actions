import { endGroup, info, setOutput, startGroup, warning } from '@actions/core';
import { createOctokit } from '@simbo-actions/octokit';

import { parseActionInputs } from './action-inputs.js';
import { getFilesToCommit } from './get-files-to-commit.js';
import { getHeadOid, getRepositoryRoot } from './git.js';
import { createCommitOnBranch, createTag, getBranchHeadOid } from './github-api.js';
import { EXPECTED_HEAD_OID_REMOTE, TAGS_RATE_LIMIT_WARNING_THRESHOLD } from './signed-commit-constants.js';
import type { FileChanges, ParsedActionInputs } from './signed-commit.types.js';
import { syncLocal } from './sync-local.js';

/**
 * Determines the object ID the branch head must have for the commit.
 *
 * @param inputs - The parsed action inputs.
 * @param remoteHeadOid - The current head of the remote branch.
 * @returns The expected head object ID.
 * @throws {Error} if the expected head is invalid or differs from the remote branch head.
 */
async function resolveExpectedHeadOid(inputs: ParsedActionInputs, remoteHeadOid: string): Promise<string> {
  const { expectedHeadOid: input, workingDirectory, branch } = inputs;

  if (input === EXPECTED_HEAD_OID_REMOTE) {
    return remoteHeadOid;
  }

  let expected: string | undefined;
  let source: string;
  if (input) {
    if (!/^[\da-f]{40}$/.test(input)) {
      throw new Error(`Invalid input "expected-head-oid": "${input}" (expected a full commit SHA or "remote").`);
    }
    expected = input;
    source = 'expected-head-oid';
  } else {
    const root = await getRepositoryRoot(workingDirectory);
    expected = root ? await getHeadOid(root) : undefined;
    source = 'local HEAD';
  }

  if (!expected) {
    return remoteHeadOid;
  }

  if (expected !== remoteHeadOid) {
    throw new Error(
      `The branch "${branch}" is at ${remoteHeadOid}, but the ${source} is ${expected}. ` +
        'The branch has moved, or the working directory is not a checkout of it. ' +
        'Set "expected-head-oid" to "remote" to commit on top of the current remote head.',
    );
  }

  return expected;
}

/**
 * Logs the file changes in a collapsible group.
 *
 * @param fileChanges - The file changes.
 */
function logFileChanges(fileChanges: FileChanges): void {
  startGroup(`Files (${fileChanges.additions.length} added or changed, ${fileChanges.deletions.length} deleted)`);
  for (const { path } of fileChanges.additions) {
    info(`+ ${path}`);
  }
  for (const { path } of fileChanges.deletions) {
    info(`- ${path}`);
  }
  endGroup();
}

/**
 * Main entry point for the signed-commit action.
 *
 * @throws {Error} if any input is invalid, the branch does not exist, the branch
 * has moved, there are no changes (with `if-no-changes: error`), or an API call fails.
 */
export async function main(): Promise<void> {
  const inputs = parseActionInputs();
  const { owner, repo, branch, message, tags, ifNoChanges } = inputs;
  const repository = { owner, repo };
  const octokit = createOctokit(inputs.token);

  const remoteHeadOid = await getBranchHeadOid(octokit, repository, branch);
  if (!remoteHeadOid) {
    throw new Error(
      `The branch "${branch}" does not exist in ${owner}/${repo}. ` +
        'The branch must exist before committing; an empty repository needs an initial commit first.',
    );
  }

  const expectedHeadOid = await resolveExpectedHeadOid(inputs, remoteHeadOid);
  const fileChanges = await getFilesToCommit(inputs);

  setOutput(
    'files',
    JSON.stringify({
      additions: fileChanges.additions.map(({ path }) => path),
      deletions: fileChanges.deletions.map(({ path }) => path),
    }),
  );

  if (fileChanges.additions.length === 0 && fileChanges.deletions.length === 0) {
    setOutput('committed', 'false');
    setOutput('commit-sha', '');
    const notice = 'There are no changes to commit.';
    switch (ifNoChanges) {
      case 'error': {
        throw new Error(notice);
      }
      case 'warn': {
        warning(notice);
        break;
      }
      default: {
        info(notice);
      }
    }
    if (tags.length > 0) {
      warning(`Skipping tags without a commit: ${tags.join(', ')}`);
    }
    return;
  }

  logFileChanges(fileChanges);

  const commitOid = await createCommitOnBranch(octokit, {
    repository,
    branch,
    expectedHeadOid,
    message,
    fileChanges,
  });
  setOutput('committed', 'true');
  setOutput('commit-sha', commitOid);
  info(`Created verified commit ${commitOid} on ${owner}/${repo}@${branch}.`);

  // One API call per tag, so that every tag triggers its own push event.
  if (tags.length > TAGS_RATE_LIMIT_WARNING_THRESHOLD) {
    warning(
      `Creating ${tags.length} tags: GitHub limits content creation to 80 requests per minute, ` +
        'so the action may wait for the rate limit.',
    );
  }
  for (const tag of tags) {
    const created = await createTag(octokit, repository, tag, commitOid);
    info(created ? `Created tag ${tag}.` : `Tag ${tag} already points to ${commitOid}.`);
  }

  if (inputs.sync) {
    await syncLocal({
      workingDirectory: inputs.workingDirectory,
      branch,
      parentOid: expectedHeadOid,
      commitOid,
      tags,
    });
  }
}
