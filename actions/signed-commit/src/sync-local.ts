import { info, warning } from '@actions/core';

import { getHeadOid, getRepositoryRoot, git, gitSucceeds } from './git.js';

/**
 * Brings a local checkout up to date with a commit created via the API.
 *
 * Fetches the branch from `origin`, moves `HEAD` to the commit with a mixed
 * reset, and creates the tags locally. Files in the working tree are never
 * changed. Skips if the working directory is not a Git repository or if its
 * `HEAD` is not the parent of the commit.
 *
 * @param params - The sync parameters.
 * @param params.workingDirectory - The local working directory.
 * @param params.branch - The branch the commit was created on.
 * @param params.parentOid - The object ID of the parent of the commit.
 * @param params.commitOid - The object ID of the created commit.
 * @param params.tags - The tags created on the commit.
 * @returns `true` if the checkout was updated.
 */
export async function syncLocal(params: {
  workingDirectory: string;
  branch: string;
  parentOid: string;
  commitOid: string;
  tags: string[];
}): Promise<boolean> {
  const { workingDirectory, branch, parentOid, commitOid, tags } = params;

  const root = await getRepositoryRoot(workingDirectory);
  if (!root) {
    info('Skipping sync: the working directory is not a Git repository.');
    return false;
  }

  if ((await getHeadOid(root)) !== parentOid) {
    info('Skipping sync: the local HEAD is not the parent of the new commit.');
    return false;
  }

  try {
    await git(root, ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    if (!(await gitSucceeds(root, ['cat-file', '-e', commitOid]))) {
      throw new Error(`commit ${commitOid} not found after fetching ${branch}`);
    }
    await git(root, ['reset', '--mixed', '--quiet', commitOid]);
    for (const tag of tags) {
      if (!(await gitSucceeds(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]))) {
        await git(root, ['tag', tag, commitOid]);
      }
    }
  } catch (error) {
    warning(`Failed to sync the local checkout: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }

  info(`Synced local checkout to ${commitOid}.`);
  return true;
}
