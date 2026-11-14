import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { warning } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { countCommits, hasCommit, isShallowRepository, listRemoteBranches } from './git.js';
import type { ParsedActionInputs, WorkflowEvent } from './gitleaks-scan.types.js';
import { getEventRange, readWorkflowEvent, resolveScanTarget } from './scan-target.js';

vi.mock('@actions/core', () => ({ warning: vi.fn() }));
vi.mock('./git.js', () => ({
  countCommits: vi.fn(),
  hasCommit: vi.fn(),
  isShallowRepository: vi.fn(),
  listRemoteBranches: vi.fn(),
}));

const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
const zero = '0'.repeat(40);

const inputs: ParsedActionInputs = {
  workingDirectory: 'repo',
  scope: 'auto',
  logOpts: '',
  config: '',
  baselinePath: '',
  failOnFindings: true,
};

const pullRequest: WorkflowEvent = {
  name: 'pull_request',
  payload: { pull_request: { base: { sha: base }, head: { sha: head } } },
};

/**
 * Creates a push event.
 *
 * @param before - The previous commit.
 * @returns The event.
 */
function push(before: string): WorkflowEvent {
  return { name: 'push', payload: { before, after: head, ref: 'refs/heads/feature' } };
}

describe('readWorkflowEvent', () => {
  it('reads the event name and payload', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gitleaks-scan-'));
    const path = join(directory, 'event.json');
    await writeFile(path, JSON.stringify({ before: base }));
    expect(await readWorkflowEvent({ GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: path })).toEqual({
      name: 'push',
      payload: { before: base },
    });
    await rm(directory, { recursive: true, force: true });
  });

  it('uses an empty event without the environment', async () => {
    expect(await readWorkflowEvent({})).toEqual({ name: '', payload: {} });
  });
});

describe('getEventRange', () => {
  it('reads the commits of a pull request', () => {
    expect(getEventRange(pullRequest)).toEqual({ base, head });
    expect(getEventRange({ ...pullRequest, name: 'pull_request_target' })).toEqual({ base, head });
  });

  it('reads the commits of a merge group', () => {
    expect(
      getEventRange({ name: 'merge_group', payload: { merge_group: { base_sha: base, head_sha: head } } }),
    ).toEqual({
      base,
      head,
    });
  });

  it('reads the commits of a push', () => {
    expect(getEventRange(push(base))).toEqual({ base, head, ref: 'refs/heads/feature' });
  });

  it.each<[string, WorkflowEvent]>([
    ['other events', { name: 'schedule', payload: {} }],
    ['missing commits', { name: 'pull_request', payload: { pull_request: 'unexpected' } }],
    ['invalid SHAs', { name: 'push', payload: { before: 'main', after: head } }],
    ['deleted refs', { name: 'push', payload: { before: base, after: zero } }],
  ])('returns nothing for %s', (_, event) => {
    expect(getEventRange(event)).toBeUndefined();
  });
});

describe('resolveScanTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isShallowRepository).mockResolvedValue(false);
    vi.mocked(hasCommit).mockResolvedValue(true);
    vi.mocked(countCommits).mockResolvedValue(3);
    vi.mocked(listRemoteBranches).mockResolvedValue(['origin/HEAD', 'origin/feature', 'origin/main']);
  });

  it('scans the files for the scope "files"', async () => {
    expect(await resolveScanTarget({ ...inputs, scope: 'files' }, pullRequest)).toEqual({
      mode: 'dir',
      logOpts: '',
      description: 'files',
    });
  });

  it('uses the log options over the scope', async () => {
    expect(await resolveScanTarget({ ...inputs, logOpts: '--since=2024-01-01' }, pullRequest)).toEqual({
      mode: 'git',
      logOpts: '--since=2024-01-01',
      description: 'commits of "--since=2024-01-01"',
    });
  });

  it('scans the history for the scope "history"', async () => {
    expect(await resolveScanTarget({ ...inputs, scope: 'history' }, pullRequest)).toEqual({
      mode: 'git',
      logOpts: '',
      description: 'history',
    });
  });

  it('scans the commits of a pull request', async () => {
    expect(await resolveScanTarget(inputs, pullRequest)).toEqual({
      mode: 'git',
      logOpts: `${base}..${head}`,
      description: 'changes aaaaaaa..bbbbbbb (3 commits)',
    });
    expect(countCommits).toHaveBeenCalledWith('repo', [`${base}..${head}`]);
  });

  it('scans the pushed commits, also for the scope "changes"', async () => {
    vi.mocked(countCommits).mockResolvedValue(1);
    expect(await resolveScanTarget({ ...inputs, scope: 'changes' }, push(base))).toMatchObject({
      logOpts: `${base}..${head}`,
      description: 'changes aaaaaaa..bbbbbbb (1 commit)',
    });
  });

  it('scans the commits of a new branch that no other branch contains', async () => {
    expect(await resolveScanTarget(inputs, push(zero))).toEqual({
      mode: 'git',
      logOpts: `${head} --not --exclude=*/HEAD --exclude=*/feature --remotes`,
      description: 'changes bbbbbbb not on other branches (3 commits)',
    });
    expect(warning).not.toHaveBeenCalled();
  });

  it('scans the commits of a new tag that no branch contains', async () => {
    const event = { name: 'push', payload: { before: zero, after: head, ref: 'refs/tags/v1.0.0' } };
    expect(await resolveScanTarget(inputs, event)).toMatchObject({
      logOpts: `${head} --not --exclude=*/HEAD --exclude=*/v1.0.0 --remotes`,
    });
  });

  it('scans the history of the first push, with a warning', async () => {
    vi.mocked(listRemoteBranches).mockResolvedValue(['origin/feature']);
    expect(await resolveScanTarget(inputs, push(zero))).toMatchObject({ description: 'history' });
    expect(warning).toHaveBeenCalledWith(
      'A new branch or tag has no previous commit and no other remote branch to compare with; scanning the whole history.',
    );
  });

  it('scans the new commits after a force push', async () => {
    vi.mocked(hasCommit).mockImplementation(async (_, sha) => sha === head);
    expect(await resolveScanTarget(inputs, push(base))).toMatchObject({
      description: 'changes bbbbbbb not on other branches (3 commits)',
    });
  });

  it('fails if the head commit is missing', async () => {
    vi.mocked(hasCommit).mockResolvedValue(false);
    vi.mocked(isShallowRepository).mockResolvedValue(true);
    await expect(resolveScanTarget(inputs, pullRequest)).rejects.toThrow(
      'The head commit bbbbbbb of the pull_request event is not in the repository (shallow clone). Check it out with "fetch-depth: 0".',
    );
  });

  it('fails if the base commit of a pull request is missing', async () => {
    vi.mocked(hasCommit).mockImplementation(async (_, sha) => sha === head);
    await expect(resolveScanTarget(inputs, pullRequest)).rejects.toThrow(
      'The base commit aaaaaaa of the pull_request event is not in the repository. Check it out with "fetch-depth: 0".',
    );
  });

  it('fails if the previous commit of a push is missing in a shallow clone', async () => {
    vi.mocked(hasCommit).mockImplementation(async (_, sha) => sha === head);
    vi.mocked(isShallowRepository).mockResolvedValue(true);
    await expect(resolveScanTarget(inputs, push(base))).rejects.toThrow('The base commit aaaaaaa of the push event');
  });

  it('scans the history for other events with the scope "auto"', async () => {
    expect(await resolveScanTarget(inputs, { name: 'schedule', payload: {} })).toMatchObject({
      description: 'history',
    });
  });

  it('fails for other events with the scope "changes"', async () => {
    await expect(resolveScanTarget({ ...inputs, scope: 'changes' }, { name: 'schedule', payload: {} })).rejects.toThrow(
      'The scope "changes" needs a pull_request, merge_group, or push event with commits, but the event is "schedule".',
    );
  });
});
