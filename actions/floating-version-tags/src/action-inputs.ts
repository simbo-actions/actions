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
 * Parses the prefix input.
 *
 * @returns The prefix, possibly empty.
 * @throws {Error} if the prefix contains characters that are not allowed in tag names.
 */
function parsePrefix(): string {
  const prefix = getInput('prefix');
  if (prefix && (!/^[\w./@-]+$/.test(prefix) || /^[/-]|\.\.|\/\/|\.lock\/|^\.|\/\./.test(prefix))) {
    throw new Error(`Invalid input "prefix": "${prefix}" is not a valid start of a tag name.`);
  }
  return prefix;
}

/**
 * Parses the tag input; defaults to the tag the workflow runs for.
 *
 * @returns The tag name.
 * @throws {Error} if the input is empty and the workflow does not run for a tag.
 */
function parseTag(): string {
  const tag = getInput('tag')
    .trim()
    .replace(/^refs\/tags\//, '');
  if (tag) {
    return tag;
  }
  const ref = env.GITHUB_REF ?? '';
  if (ref.startsWith('refs/tags/')) {
    return ref.slice('refs/tags/'.length);
  }
  throw new Error(
    `Input required: "tag". It defaults to the tag the workflow runs for (a tag push or a release), but the ref is "${ref}".`,
  );
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
  const tag = parseTag();
  const naming = { prefix: parsePrefix(), vPrefix: parseBoolean('v-prefix', true) };
  const major = parseBoolean('major', true);
  const minor = parseBoolean('minor', false);
  const latest = parseBoolean('latest', false);
  if (!major && !minor && !latest) {
    throw new Error('No floating tag enabled: set at least one of "major", "minor", or "latest" to "true".');
  }
  const annotated = parseBoolean('annotated', false);
  const dryRun = parseBoolean('dry-run', false);
  return { token, owner, repo, tag, naming, major, minor, latest, annotated, dryRun };
}
