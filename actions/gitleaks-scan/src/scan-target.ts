import { readFile } from 'node:fs/promises';

import { warning } from '@actions/core';

import { countCommits, hasCommit, isShallowRepository, listRemoteBranches } from './git.js';
import { SHORT_SHA_LENGTH } from './gitleaks-scan-constants.js';
import type { EventRange, ParsedActionInputs, ScanTarget, WorkflowEvent } from './gitleaks-scan.types.js';

/**
 * Matches a full commit SHA.
 */
const SHA_PATTERN = /^[0-9a-f]{40}$/;

/**
 * Matches the SHA GitHub sends for a commit that does not exist, for example
 * `before` of a new branch.
 */
const ZERO_SHA_PATTERN = /^0{40}$/;

/**
 * Reads the workflow event from the environment of the runner.
 *
 * @param env - The environment variables.
 * @returns The event; the payload is empty if there is no event file.
 */
export async function readWorkflowEvent(env: NodeJS.ProcessEnv): Promise<WorkflowEvent> {
  const name = env.GITHUB_EVENT_NAME ?? '';
  const payload = env.GITHUB_EVENT_PATH
    ? (JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8')) as Record<string, unknown>)
    : {};
  return { name, payload };
}

/**
 * Reads a nested string from an event payload.
 *
 * @param payload - The payload.
 * @param path - The keys of the value.
 * @returns The string, or an empty string if it is missing.
 */
function readString(payload: Record<string, unknown>, ...path: string[]): string {
  let value: unknown = payload;
  for (const key of path) {
    value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  }
  return typeof value === 'string' ? value : '';
}

/**
 * Reads the range of an event payload.
 *
 * @param name - The event name.
 * @param payload - The event payload.
 * @returns The range as sent, or `undefined` for events without commits.
 */
function readRange(name: string, payload: Record<string, unknown>): EventRange | undefined {
  switch (name) {
    case 'pull_request':
    case 'pull_request_target': {
      return {
        base: readString(payload, 'pull_request', 'base', 'sha'),
        head: readString(payload, 'pull_request', 'head', 'sha'),
      };
    }
    case 'merge_group': {
      return {
        base: readString(payload, 'merge_group', 'base_sha'),
        head: readString(payload, 'merge_group', 'head_sha'),
      };
    }
    case 'push': {
      return {
        base: readString(payload, 'before'),
        head: readString(payload, 'after'),
        ref: readString(payload, 'ref'),
      };
    }
    default: {
      return undefined;
    }
  }
}

/**
 * Gets the commits an event introduces.
 *
 * - pull requests: the commits of the pull request, from its base to its head
 *   (not the merge commit);
 * - merge groups: the commits of the merge group;
 * - pushes: the pushed commits.
 *
 * @param event - The workflow event.
 * @returns The range, or `undefined` for other events and deleted refs.
 */
export function getEventRange(event: WorkflowEvent): EventRange | undefined {
  const range = readRange(event.name, event.payload);
  const valid =
    range !== undefined &&
    SHA_PATTERN.test(range.base) &&
    SHA_PATTERN.test(range.head) &&
    !ZERO_SHA_PATTERN.test(range.head);
  return valid ? range : undefined;
}

/**
 * Abbreviates a commit SHA.
 *
 * @param sha - The SHA.
 * @returns The first characters.
 */
function short(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}

/**
 * Formats a number of commits.
 *
 * @param count - The number.
 * @returns For example `1 commit` or `3 commits`.
 */
function commits(count: number): string {
  return `${count} commit${count === 1 ? '' : 's'}`;
}

/**
 * The target that scans the whole history.
 */
const HISTORY: ScanTarget = { mode: 'git', logOpts: '', description: 'history' };

/**
 * Selects the commits of a pushed ref that no other remote branch contains,
 * for a new branch or a force push, where there is no previous commit to
 * compare with.
 *
 * Falls back to the whole history if there is no other remote branch.
 *
 * @param cwd - The repository.
 * @param range - The pushed range.
 * @param reason - Why the previous commit cannot be used, for the warning.
 * @returns The scan target.
 */
async function unseenCommitsTarget(cwd: string, range: EventRange, reason: string): Promise<ScanTarget> {
  const branch = range.ref?.replace(/^refs\/(heads|tags)\//, '') ?? '';
  const others = (await listRemoteBranches(cwd)).filter(name => {
    const remoteBranch = name.slice(name.indexOf('/') + 1);
    return remoteBranch !== 'HEAD' && remoteBranch !== branch;
  });
  if (others.length === 0) {
    warning(`${reason} and no other remote branch to compare with; scanning the whole history.`);
    return HISTORY;
  }
  const revisions = [
    range.head,
    '--not',
    '--exclude=*/HEAD',
    ...(branch ? [`--exclude=*/${branch}`] : []),
    '--remotes',
  ];
  const count = await countCommits(cwd, revisions);
  return {
    mode: 'git',
    logOpts: revisions.join(' '),
    description: `changes ${short(range.head)} not on other branches (${commits(count)})`,
  };
}

/**
 * Selects the commits of an event range.
 *
 * @param cwd - The repository.
 * @param event - The event name, for messages.
 * @param range - The range.
 * @returns The scan target.
 * @throws {Error} if a commit of the range is missing in the repository.
 */
async function rangeTarget(cwd: string, event: string, range: EventRange): Promise<ScanTarget> {
  const shallow = await isShallowRepository(cwd);
  const missing = (role: string, sha: string): Error =>
    new Error(
      `The ${role} commit ${short(sha)} of the ${event} event is not in the repository${shallow ? ' (shallow clone)' : ''}. Check it out with "fetch-depth: 0".`,
    );
  if (!(await hasCommit(cwd, range.head))) {
    throw missing('head', range.head);
  }
  if (ZERO_SHA_PATTERN.test(range.base)) {
    return unseenCommitsTarget(cwd, range, 'A new branch or tag has no previous commit');
  }
  if (!(await hasCommit(cwd, range.base))) {
    if (event !== 'push' || shallow) {
      throw missing('base', range.base);
    }
    // A complete clone lacks the previous commit only if it was force-pushed away.
    return unseenCommitsTarget(cwd, range, `The previous commit ${short(range.base)} is gone (force push)`);
  }
  const revision = `${range.base}..${range.head}`;
  const count = await countCommits(cwd, [revision]);
  return {
    mode: 'git',
    logOpts: revision,
    description: `changes ${short(range.base)}..${short(range.head)} (${commits(count)})`,
  };
}

/**
 * Determines what Gitleaks scans, from the inputs and the workflow event.
 *
 * - `files`: the files of the working tree;
 * - `log-opts`: the commits `git log` selects with them;
 * - `history`: all commits;
 * - `changes`: the commits of the event, or an error for events without
 *   commits;
 * - `auto`: like `changes`, but the whole history for events without commits.
 *
 * @param inputs - The action inputs.
 * @param event - The workflow event.
 * @returns The scan target.
 * @throws {Error} if the event has no commits for `changes`, or a commit of the event is missing.
 */
export async function resolveScanTarget(inputs: ParsedActionInputs, event: WorkflowEvent): Promise<ScanTarget> {
  const { scope, logOpts, workingDirectory } = inputs;
  if (scope === 'files') {
    return { mode: 'dir', logOpts: '', description: 'files' };
  }
  if (logOpts) {
    return { mode: 'git', logOpts, description: `commits of "${logOpts}"` };
  }
  if (scope === 'history') {
    return HISTORY;
  }
  const range = getEventRange(event);
  if (range) {
    return rangeTarget(workingDirectory, event.name, range);
  }
  if (scope === 'changes') {
    throw new Error(
      `The scope "changes" needs a pull_request, merge_group, or push event with commits, but the event is "${event.name}". Use the scope "auto" to scan the whole history for other events.`,
    );
  }
  return HISTORY;
}
