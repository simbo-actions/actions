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

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'staged-release-'));
    setInput('token', 'token');
    setInput('tag', 'v1.0.0');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it('applies defaults', async () => {
    expect(await parseActionInputs()).toEqual({
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      tag: 'v1.0.0',
      name: 'v1.0.0',
      body: '',
      assetPatterns: [],
      workingDirectory: '.',
      makeLatest: 'true',
      prerelease: false,
      publish: true,
    });
  });

  it('parses all inputs', async () => {
    setInput('repository', 'other/name');
    setInput('name', 'Release 1.0.0');
    setInput('body', 'Notes');
    setInput('assets', ' dist/*.tar.gz \n\nSHA256SUMS\r\n');
    setInput('working-directory', 'out');
    setInput('make-latest', 'LEGACY');
    setInput('prerelease', 'true');
    setInput('publish', 'false');

    expect(await parseActionInputs()).toEqual({
      token: 'token',
      owner: 'other',
      repo: 'name',
      tag: 'v1.0.0',
      name: 'Release 1.0.0',
      body: 'Notes',
      assetPatterns: ['dist/*.tar.gz', 'SHA256SUMS'],
      workingDirectory: 'out',
      makeLatest: 'legacy',
      prerelease: true,
      publish: false,
    });
  });

  it('reads the body from a file', async () => {
    await writeFile(join(directory, 'notes.md'), '### Changes\n');
    setInput('working-directory', directory);
    setInput('body-file', 'notes.md');
    expect((await parseActionInputs()).body).toBe('### Changes\n');
  });

  it('rejects body and body-file together', async () => {
    setInput('body', 'Notes');
    setInput('body-file', 'notes.md');
    await expect(parseActionInputs()).rejects.toThrow('either "body" or "body-file"');
  });

  it('rejects a missing body-file', async () => {
    setInput('body-file', join(directory, 'missing.md'));
    await expect(parseActionInputs()).rejects.toThrow('Cannot read "body-file"');
  });

  it.each([
    ['repository', 'invalid', 'Invalid input "repository"'],
    ['make-latest', 'yes', 'Invalid input "make-latest"'],
    ['prerelease', 'yes', 'Invalid input "prerelease"'],
    ['tag', '', 'tag'],
    ['token', '', 'token'],
  ])('rejects invalid %s', async (name, value, error) => {
    setInput(name, value);
    await expect(parseActionInputs()).rejects.toThrow(error);
  });
});
