import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from 'node:process';

import { getInput } from '@actions/core';

import { MAKE_LATEST_OPTIONS } from './staged-release-constants.js';
import type { MakeLatestOption, ParsedActionInputs } from './staged-release.types.js';

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
 * Reads the release notes from `body` or `body-file`.
 *
 * @param workingDirectory - The directory relative paths are resolved against.
 * @returns The release notes.
 * @throws {Error} if both inputs are set or the file cannot be read.
 */
async function parseBody(workingDirectory: string): Promise<string> {
  const body = getInput('body');
  const bodyFile = getInput('body-file');
  if (body && bodyFile) {
    throw new Error('Use either "body" or "body-file", not both.');
  }
  if (!bodyFile) {
    return body;
  }
  try {
    return await readFile(resolve(workingDirectory, bodyFile), 'utf8');
  } catch (error) {
    throw new Error(`Cannot read "body-file": ${bodyFile}`, { cause: error });
  }
}

/**
 * Parses the action inputs from GitHub Actions.
 *
 * @returns The parsed action inputs.
 * @throws {Error} if an input is missing or invalid.
 */
export async function parseActionInputs(): Promise<ParsedActionInputs> {
  const token = getInput('token', { required: true });
  const { owner, repo } = parseRepository();
  const tag = getInput('tag', { required: true }).trim();
  const name = getInput('name') || tag;
  const workingDirectory = getInput('working-directory') || '.';
  const body = await parseBody(workingDirectory);
  const assetPatterns = getInput('assets')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const makeLatest = (getInput('make-latest') || 'true').toLowerCase();
  if (!(MAKE_LATEST_OPTIONS as readonly string[]).includes(makeLatest)) {
    throw new Error(
      `Invalid input "make-latest": "${makeLatest}" (expected one of: ${MAKE_LATEST_OPTIONS.join(', ')}).`,
    );
  }
  const prerelease = parseBoolean('prerelease', false);
  const publish = parseBoolean('publish', true);

  return {
    token,
    owner,
    repo,
    tag,
    name,
    body,
    assetPatterns,
    workingDirectory,
    makeLatest: makeLatest as MakeLatestOption,
    prerelease,
    publish,
  };
}
