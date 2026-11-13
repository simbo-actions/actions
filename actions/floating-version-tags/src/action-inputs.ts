import { env } from 'node:process';

import { getInput } from '@actions/core';

import type { ParsedActionInputs } from './floating-version-tags.types.js';

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
 * Parses the action inputs from GitHub Actions.
 *
 * @returns The parsed action inputs.
 * @throws {Error} if an input is missing or invalid, or no floating tag is enabled.
 */
export function parseActionInputs(): ParsedActionInputs {
  const token = getInput('token', { required: true });
  const { owner, repo } = parseRepository();
  const tag = getInput('tag', { required: true }).trim();
  const major = parseBoolean('major', true);
  const minor = parseBoolean('minor', false);
  const latest = parseBoolean('latest', false);
  if (!major && !minor && !latest) {
    throw new Error('No floating tag enabled: set at least one of "major", "minor", or "latest" to "true".');
  }
  const dryRun = parseBoolean('dry-run', false);
  return { token, owner, repo, tag, major, minor, latest, dryRun };
}
