import { readFile } from 'node:fs/promises';
import { env } from 'node:process';

import { getInput } from '@actions/core';

import type { ParsedActionInputs } from './apply-repository-settings.types.js';
import { parseConfig } from './parse-config.js';

/**
 * Parses the action inputs from GitHub Actions and reads the configuration.
 * The inputs `description`, `homepage`, and `topics` override the configured values.
 *
 * @returns The parsed action inputs.
 * @throws {Error} if an input is missing or invalid, or the configuration cannot be read.
 */
export async function parseActionInputs(): Promise<ParsedActionInputs> {
  const token = getInput('token', { required: true });

  const repository = getInput('repository') || (env.GITHUB_REPOSITORY ?? '');
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(repository);
  if (!match) {
    throw new Error(`Invalid input "repository": "${repository}" (expected "owner/repo").`);
  }

  const configPath = getInput('config', { required: true });
  let text: string;
  try {
    text = await readFile(configPath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read the configuration file: ${configPath}`, { cause: error });
  }
  const config = parseConfig(text);

  const overrides = Object.fromEntries(
    ['description', 'homepage'].map(name => [name, getInput(name)] as const).filter(([, value]) => value !== ''),
  );
  if (Object.keys(overrides).length > 0) {
    config.repository = { ...config.repository, ...overrides };
  }
  const topics = getInput('topics');
  if (topics) {
    config.topics = parseConfig(JSON.stringify({ topics: topics.split(/[\s,]+/).filter(Boolean) })).topics;
  }

  const dryRun = getInput('dry-run').toLowerCase();
  if (dryRun !== '' && dryRun !== 'true' && dryRun !== 'false') {
    throw new Error(`Invalid input "dry-run": "${dryRun}" (expected "true" or "false").`);
  }

  return { token, owner: match[1], repo: match[2], config, dryRun: dryRun === 'true' };
}
