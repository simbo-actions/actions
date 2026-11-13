import { env } from 'node:process';

import { endGroup, info, setOutput, startGroup, warning } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import { getFilesToCommit } from './get-files-to-commit.js';
import { getHeadOid, getRepositoryRoot } from './git.js';
import {
  createBranch,
  createCommitOnBranch,
  createTag,
  getBranchHeadOid,
  getDefaultBranch,
  type Octokit,
  type RepositoryRef,
} from './github-api.js';
import { EXPECTED_HEAD_OID_REMOTE, TAGS_RATE_LIMIT_WARNING_THRESHOLD } from './signed-commit-constants.js';
import type { BranchHead, FileChanges, ParsedActionInputs } from './signed-commit.types.js';
import { writeSummary } from './summary.js';
import { syncLocal } from './sync-local.js';

/**
 * Matches a full commit SHA.
 */
const SHA_PATTERN = /^[\da-f]{40}$/;

/**
 * Determines the head of the branch, or where a missing branch will start.
 *
 * @param octokit - The Octokit client.
 * @param inputs - The parsed action inputs.
 * @returns The head commit, and the base of a branch to create.
 * @throws {Error} if the branch is missing without "create-branch", or the base branch is missing.
 */
async function resolveBranchHead(octokit: Octokit, inputs: ParsedActionInputs): Promise<BranchHead> {
  const { owner, repo, branch } = inputs;
  const repository = { owner, repo };
  const oid = await getBranchHeadOid(octokit, repository, branch);
  if (oid) {
    return { oid };
  }
  if (!inputs.shouldCreateBranch) {
    throw new Error(
      `The branch "${branch}" does not exist in ${owner}/${repo}. ` +
        'Set "create-branch" to "true" to create it; an empty repository needs an initial commit first.',
    );
  }
  if (SHA_PATTERN.test(inputs.base)) {
    return { oid: inputs.base, createdFrom: inputs.base };
  }
  const base = inputs.base || (await getDefaultBranch(octokit, repository));
  const baseOid = await getBranchHeadOid(octokit, repository, base);
  if (!baseOid) {
    throw new Error(`The base branch "${base}" of the new branch "${branch}" does not exist in ${owner}/${repo}.`);
  }
  return { oid: baseOid, createdFrom: base };
}

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
    if (!SHA_PATTERN.test(input)) {
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
 * Creates the tags on a commit, one API call per tag, so that every tag
 * triggers its own push event.
 *
 * @param octokit - The Octokit client.
 * @param repository - The repository.
 * @param tags - The tags to create.
 * @param sha - The commit object ID.
 * @returns Every tag, and whether it was created or already pointed to the commit.
 * @throws {Error} if a tag exists on another commit or cannot be created.
 */
async function createTags(
  octokit: Octokit,
  repository: RepositoryRef,
  tags: string[],
  sha: string,
): Promise<{ name: string; created: boolean }[]> {
  if (tags.length > TAGS_RATE_LIMIT_WARNING_THRESHOLD) {
    warning(
      `Creating ${tags.length} tags: GitHub limits content creation to 80 requests per minute, ` +
        'so the action may wait for the rate limit.',
    );
  }
  const results: { name: string; created: boolean }[] = [];
  for (const tag of tags) {
    const created = await createTag(octokit, repository, tag, sha);
    info(created ? `Created tag ${tag}.` : `Tag ${tag} already points to ${sha}.`);
    results.push({ name: tag, created });
  }
  return results;
}

/**
 * Main entry point for the signed-commit action.
 *
 * @throws {Error} if any input is invalid, the branch does not exist (without
 * `create-branch`), the branch has moved, there are no changes (with
 * `if-no-changes: error`), or an API call fails.
 */
export async function main(): Promise<void> {
  const inputs = parseActionInputs();
  const { owner, repo, branch, message, tags, ifNoChanges } = inputs;
  const repository = { owner, repo };
  const fullName = `${owner}/${repo}`;
  const octokit = createOctokit(inputs.token);

  const head = await resolveBranchHead(octokit, inputs);
  const expectedHeadOid = await resolveExpectedHeadOid(inputs, head.oid);
  const fileChanges = await getFilesToCommit(inputs);
  const hasChanges = fileChanges.additions.length > 0 || fileChanges.deletions.length > 0;

  setOutput(
    'files',
    JSON.stringify({
      additions: fileChanges.additions.map(({ path }) => path),
      deletions: fileChanges.deletions.map(({ path }) => path),
    }),
  );

  if (!hasChanges) {
    setOutput('committed', 'false');
    setOutput('commit-sha', '');
    setOutput('commit-url', '');
    if (ifNoChanges === 'error') {
      throw new Error('There are no changes to commit.');
    }
  }

  if (head.createdFrom) {
    await createBranch(octokit, repository, branch, head.oid);
    info(`Created branch ${branch} from ${head.createdFrom} at ${head.oid}.`);
  }

  if (!hasChanges) {
    (ifNoChanges === 'warn' ? warning : info)('There are no changes to commit.');
    // Tags that a previous run could not create are created on the current head.
    if (tags.length > 0) {
      info(`Tagging the current head ${expectedHeadOid} of ${branch}.`);
    }
    const headTags = await createTags(octokit, repository, tags, expectedHeadOid);
    await writeSummary({ repository: fullName, branch, head, message, commitUrl: '', tags: headTags, fileChanges });
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
  const commitUrl = `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${fullName}/commit/${commitOid}`;
  setOutput('committed', 'true');
  setOutput('commit-sha', commitOid);
  setOutput('commit-url', commitUrl);
  info(`Created verified commit ${commitOid} on ${fullName}@${branch}.`);

  const tagResults = await createTags(octokit, repository, tags, commitOid);

  if (inputs.sync) {
    await syncLocal({
      workingDirectory: inputs.workingDirectory,
      branch,
      parentOid: expectedHeadOid,
      commitOid,
      tags,
      switchBranch: head.createdFrom !== undefined,
    });
  }

  await writeSummary({
    repository: fullName,
    branch,
    head,
    message,
    commitOid,
    commitUrl,
    tags: tagResults,
    fileChanges,
  });
}
