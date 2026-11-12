import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';

/**
 * Sets an action input as environment variable, like the runner does.
 *
 * @param name - The input name.
 * @param value - The input value.
 */
function setInput(name: string, value: string): void {
  vi.stubEnv(`INPUT_${name.toUpperCase()}`, value);
}

describe('parseActionInputs', () => {
  let directory: string;
  let configPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'apply-repository-settings-'));
    configPath = join(directory, 'settings.json');
    await writeFile(configPath, JSON.stringify({ repository: { description: 'From file', has_issues: false } }));
    setInput('token', 'token');
    setInput('config', configPath);
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it('reads the configuration with defaults', async () => {
    expect(await parseActionInputs()).toEqual({
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      config: { repository: { description: 'From file', has_issues: false } },
      dryRun: false,
    });
  });

  it('overrides description and homepage and parses dry-run', async () => {
    setInput('repository', 'other/name');
    setInput('description', 'From input');
    setInput('homepage', 'https://example.com');
    setInput('dry-run', 'TRUE');
    expect(await parseActionInputs()).toEqual({
      token: 'token',
      owner: 'other',
      repo: 'name',
      config: { repository: { description: 'From input', has_issues: false, homepage: 'https://example.com' } },
      dryRun: true,
    });
  });

  it.each([
    ['repository', 'invalid', 'Invalid input "repository"'],
    ['dry-run', 'yes', 'Invalid input "dry-run"'],
    ['token', '', 'token'],
  ])('rejects invalid %s', async (name, value, error) => {
    setInput(name, value);
    await expect(parseActionInputs()).rejects.toThrow(error);
  });

  it('fails for a missing configuration file', async () => {
    setInput('config', join(directory, 'missing.json'));
    await expect(parseActionInputs()).rejects.toThrow('Cannot read the configuration file');
  });
});
