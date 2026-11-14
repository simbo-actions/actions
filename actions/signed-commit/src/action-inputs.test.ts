import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isValidRefName, parseActionInputs } from './action-inputs.js';

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
      shouldCreateBranch: false,
      base: '',
      filePatterns: [],
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
    setInput('create-branch', 'true');
    setInput('base', 'refs/heads/develop');
    setInput('file-pattern', 'dist/**\n!**/*.map\n');

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
      shouldCreateBranch: true,
      base: 'develop',
      filePatterns: ['dist/**', '!**/*.map'],
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
    ['branch', 'main:other', 'Invalid input "branch": "main:other" is not a valid branch name.'],
    ['branch', '-d', 'Invalid input "branch"'],
    ['tags', 'v1.0.0 -d', 'Invalid input "tags": "-d" is not a valid tag name.'],
    ['tags', 'v1..0', 'Invalid input "tags"'],
  ])('rejects invalid %s', (name, value, error) => {
    setInput(name, value);
    expect(() => parseActionInputs()).toThrow(error);
  });

  it('accepts a commit SHA as base', () => {
    setInput('create-branch', 'true');
    setInput('base', 'a'.repeat(40));
    expect(parseActionInputs().base).toBe('a'.repeat(40));
  });

  it('rejects an invalid base', () => {
    setInput('create-branch', 'true');
    setInput('base', 'a..b');
    expect(() => parseActionInputs()).toThrow(
      'Invalid input "base": "a..b" (expected a branch name or a full commit SHA).',
    );
  });

  it('rejects a base without "create-branch"', () => {
    setInput('base', 'main');
    expect(() => parseActionInputs()).toThrow('Invalid input "base": it is only used with "create-branch: true".');
  });

  it('rejects file patterns without detected changes', () => {
    setInput('detect-changes', 'none');
    setInput('file-pattern', 'dist/**');
    expect(() => parseActionInputs()).toThrow('has no effect with "detect-changes: none"');
  });

  it.each(['main', 'release/v1.2', 'pkg-a/v1.0.0', 'feature/a_b-c', 'v1.0.0+build'])(
    'accepts the ref name %s',
    name => {
      expect(isValidRefName(name)).toBe(true);
    },
  );

  it.each([
    '',
    '@',
    '-x',
    '/a',
    'a/',
    'a.',
    'a..b',
    'a//b',
    'a@{b',
    'a b',
    'a~1',
    'a^',
    'a:b',
    'a?',
    'a*',
    'a[',
    String.raw`a\b`,
    '.a',
    'a/.b',
    'a.lock',
    'a/b.lock/c',
    'a\u{1}',
  ])('rejects the ref name %j', name => {
    expect(isValidRefName(name)).toBe(false);
  });

  it('rejects an empty branch', () => {
    vi.stubEnv('GITHUB_REF_NAME', '');
    expect(() => parseActionInputs()).toThrow('Invalid input "branch"');
  });
});
