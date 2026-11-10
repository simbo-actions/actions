import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';

/**
 * Sets an action input as environment variable, like the runner does.
 *
 * @param name - The input name.
 * @param value - The input value.
 */
function setInput(name: string, value: string): void {
  vi.stubEnv(`INPUT_${name.replaceAll(' ', '_').toUpperCase()}`, value);
}

describe('parseActionInputs', () => {
  beforeEach(() => {
    setInput('token', 'secret-token');
    setInput('message', 'chore: update');
    vi.stubEnv('GITHUB_REPOSITORY', 'simbo-actions/example');
    vi.stubEnv('GITHUB_REF_NAME', 'main');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    expect(parseActionInputs()).toEqual({
      token: 'secret-token',
      message: { headline: 'chore: update' },
      owner: 'simbo-actions',
      repo: 'example',
      branch: 'main',
      workingDirectory: '.',
      additionsList: [],
      deletionsList: [],
      detectChanges: 'all',
      tags: [],
      ifNoChanges: 'error',
      sync: true,
      expectedHeadOid: '',
    });
  });

  it('parses all inputs', () => {
    setInput('message', 'feat: thing\n\nbody');
    setInput('repository', 'owner/repo.name');
    setInput('branch', 'refs/heads/release');
    setInput('working-directory', 'sub');
    setInput('additions', ' a.txt \n\nb c.txt\r\n');
    setInput('deletions', 'old.txt');
    setInput('detect-changes', 'STAGED');
    setInput('tags', 'pkg-a/v1.0.0  pkg-b/v2.0.0\nv3.0.0');
    setInput('if-no-changes', 'warn');
    setInput('sync', 'false');
    setInput('expected-head-oid', 'REMOTE');

    expect(parseActionInputs()).toEqual({
      token: 'secret-token',
      message: { headline: 'feat: thing', body: 'body' },
      owner: 'owner',
      repo: 'repo.name',
      branch: 'release',
      workingDirectory: 'sub',
      additionsList: ['a.txt', 'b c.txt'],
      deletionsList: ['old.txt'],
      detectChanges: 'staged',
      tags: ['pkg-a/v1.0.0', 'pkg-b/v2.0.0', 'v3.0.0'],
      ifNoChanges: 'warn',
      sync: false,
      expectedHeadOid: 'remote',
    });
  });

  it('requires token and message', () => {
    setInput('token', '');
    expect(() => parseActionInputs()).toThrow('token');
    setInput('token', 'secret-token');
    setInput('message', '');
    expect(() => parseActionInputs()).toThrow('message');
  });

  it.each([
    ['repository', 'no-slash', 'Invalid input "repository"'],
    ['detect-changes', 'some', 'Invalid input "detect-changes"'],
    ['if-no-changes', 'fail', 'Invalid input "if-no-changes"'],
    ['sync', 'yes', 'Invalid input "sync"'],
  ])('rejects invalid %s', (name, value, error) => {
    setInput(name, value);
    expect(() => parseActionInputs()).toThrow(error);
  });

  it('rejects an empty branch', () => {
    vi.stubEnv('GITHUB_REF_NAME', '');
    expect(() => parseActionInputs()).toThrow('Invalid input "branch"');
  });
});
