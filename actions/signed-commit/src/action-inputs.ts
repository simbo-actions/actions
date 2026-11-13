import { env } from 'node:process';

import { getInput } from '@actions/core';

import { parseCommitMessage } from './parse-commit-message.js';
import { DETECT_CHANGES_OPTIONS, IF_NO_CHANGES_OPTIONS } from './signed-commit-constants.js';
import type { DetectChangesOption, IfNoChangesOption, ParsedActionInputs } from './signed-commit.types.js';

/**
 * Splits a multi-line input into a list of trimmed, non-empty lines.
 *
 * @param input - The raw input value.
 * @returns The list of lines.
 */
function parseLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

/**
 * Parses an input that must be one of the given options.
 *
 * @param name - The input name.
 * @param options - The allowed options.
 * @param defaultValue - The value to use if the input is empty.
 * @returns The parsed option.
 * @throws {Error} if the input is not one of the options.
 */
function parseOption<T extends string>(name: string, options: readonly T[], defaultValue: T): T {
  const value = (getInput(name) || defaultValue).toLowerCase();
  if (!(options as readonly string[]).includes(value)) {
    throw new Error(`Invalid input "${name}": "${value}" (expected one of: ${options.join(', ')}).`);
  }
  return value as T;
}

/**
 * Parses a boolean input.
 *
 * @param name - The input name.
 * @param defaultValue - The value to use if the input is empty.
 * @returns The parsed boolean.
 * @throws {Error} if the input is not `true` or `false`.
 */
function parseBoolean(name: string, defaultValue: boolean): boolean {
  const value = getInput(name).toLowerCase();
  if (value === '') {
    return defaultValue;
  }
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid input "${name}": "${value}" (expected "true" or "false").`);
  }
  return value === 'true';
}

/**
 * Parses the repository input into owner and repository name.
 *
 * @returns The owner and repository name.
 * @throws {Error} if the repository is not in the format `owner/repo`.
 */
function parseRepository(): { owner: string; repo: string } {
  const repository = getInput('repository') || (env.GITHUB_REPOSITORY ?? '');
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(repository);
  if (!match) {
    throw new Error(`Invalid input "repository": "${repository}" (expected "owner/repo").`);
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Checks a branch or tag name against the rules of `git check-ref-format`,
 * and additionally rejects names starting with "-", which Git would read as an option.
 *
 * @param name - The name without `refs/heads/` or `refs/tags/`.
 * @returns `true` if the name is valid.
 */
export function isValidRefName(name: string): boolean {
  return (
    name !== '' &&
    name !== '@' &&
    !name.startsWith('-') &&
    !name.startsWith('/') &&
    !name.endsWith('/') &&
    !name.endsWith('.') &&
    !name.includes('..') &&
    !name.includes('//') &&
    !name.includes('@{') &&
    // eslint-disable-next-line no-control-regex -- control characters are forbidden in ref names
    !/[\u{0}-\u{20}\u{7F}~^:?*[\\]/u.test(name) &&
    name.split('/').every(part => !part.startsWith('.') && !part.endsWith('.lock'))
  );
}

/**
 * Parses the branch input.
 *
 * @returns The branch name without `refs/heads/` prefix.
 * @throws {Error} if the branch is empty or not a valid branch name.
 */
function parseBranch(): string {
  const branch = (getInput('branch') || (env.GITHUB_REF_NAME ?? '')).replace(/^refs\/heads\//, '');
  if (!branch) {
    throw new Error('Invalid input "branch": the branch must not be empty.');
  }
  if (!isValidRefName(branch)) {
    throw new Error(`Invalid input "branch": "${branch}" is not a valid branch name.`);
  }
  return branch;
}

/**
 * Parses the action inputs from GitHub Actions.
 *
 * @returns The parsed action inputs.
 * @throws {Error} if any input is missing or invalid.
 */
export function parseActionInputs(): ParsedActionInputs {
  const token = getInput('token', { required: true });
  const message = parseCommitMessage(getInput('message', { required: true }));
  const { owner, repo } = parseRepository();
  const branch = parseBranch();
  const workingDirectory = getInput('working-directory') || '.';
  const additionsList = parseLines(getInput('additions'));
  const deletionsList = parseLines(getInput('deletions'));
  const detectChanges = parseOption<DetectChangesOption>('detect-changes', DETECT_CHANGES_OPTIONS, 'all');
  const tags = getInput('tags').split(/\s+/).filter(Boolean);
  const invalidTag = tags.find(tag => !isValidRefName(tag));
  if (invalidTag !== undefined) {
    throw new Error(`Invalid input "tags": "${invalidTag}" is not a valid tag name.`);
  }
  const ifNoChanges = parseOption<IfNoChangesOption>('if-no-changes', IF_NO_CHANGES_OPTIONS, 'error');
  const sync = parseBoolean('sync', true);
  const expectedHeadOid = getInput('expected-head-oid').toLowerCase();

  return {
    token,
    message,
    owner,
    repo,
    branch,
    workingDirectory,
    additionsList,
    deletionsList,
    detectChanges,
    tags,
    ifNoChanges,
    sync,
    expectedHeadOid,
  };
}
