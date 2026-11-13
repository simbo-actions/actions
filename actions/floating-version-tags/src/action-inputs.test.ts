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
  beforeEach(() => {
    setInput('token', 'token');
    setInput('tag', ' v1.2.3 ');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    expect(parseActionInputs()).toEqual({
      token: 'token',
      owner: 'owner',
      repo: 'repo',
      tag: 'v1.2.3',
      major: true,
      minor: false,
      latest: false,
      dryRun: false,
    });
  });

  it('parses all inputs', () => {
    setInput('repository', 'other/name');
    setInput('major', 'false');
    setInput('minor', 'TRUE');
    setInput('latest', 'true');
    setInput('dry-run', 'true');
    expect(parseActionInputs()).toEqual({
      token: 'token',
      owner: 'other',
      repo: 'name',
      tag: 'v1.2.3',
      major: false,
      minor: true,
      latest: true,
      dryRun: true,
    });
  });

  it('requires a token and a tag', () => {
    setInput('token', '');
    expect(() => parseActionInputs()).toThrow('Input required and not supplied: token');
    setInput('token', 'token');
    setInput('tag', '');
    expect(() => parseActionInputs()).toThrow('Input required and not supplied: tag');
  });

  it('rejects an invalid repository', () => {
    setInput('repository', 'no-slash');
    expect(() => parseActionInputs()).toThrow('Invalid input "repository": "no-slash" (expected "owner/repo").');
  });

  it('rejects a missing repository', () => {
    vi.stubEnv('GITHUB_REPOSITORY', undefined);
    expect(() => parseActionInputs()).toThrow('Invalid input "repository": ""');
  });

  it('rejects an invalid boolean', () => {
    setInput('minor', 'yes');
    expect(() => parseActionInputs()).toThrow('Invalid input "minor": "yes" (expected "true" or "false").');
  });

  it('requires at least one floating tag', () => {
    setInput('major', 'false');
    expect(() => parseActionInputs()).toThrow('No floating tag enabled');
  });
});
