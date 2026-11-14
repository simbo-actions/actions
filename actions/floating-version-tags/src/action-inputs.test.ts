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
      naming: { prefix: '', vPrefix: true },
      major: true,
      minor: false,
      latest: false,
      annotated: false,
      dryRun: false,
    });
  });

  it('parses all inputs', () => {
    setInput('repository', 'other/name');
    setInput('major', 'false');
    setInput('minor', 'TRUE');
    setInput('latest', 'true');
    setInput('dry-run', 'true');
    setInput('prefix', 'my-package/');
    setInput('v-prefix', 'false');
    setInput('annotated', 'true');
    expect(parseActionInputs()).toEqual({
      token: 'token',
      owner: 'other',
      repo: 'name',
      tag: 'v1.2.3',
      naming: { prefix: 'my-package/', vPrefix: false },
      major: false,
      minor: true,
      latest: true,
      annotated: true,
      dryRun: true,
    });
  });

  it('requires a token and a tag', () => {
    setInput('token', '');
    expect(() => parseActionInputs()).toThrow('Input required and not supplied: token');
    setInput('token', 'token');
  });

  it('defaults the tag to the tag the workflow runs for', () => {
    setInput('tag', '');
    vi.stubEnv('GITHUB_REF', 'refs/tags/v2.0.0');
    expect(parseActionInputs().tag).toBe('v2.0.0');
  });

  it('accepts a full tag ref', () => {
    setInput('tag', 'refs/tags/v2.0.0');
    expect(parseActionInputs().tag).toBe('v2.0.0');
  });

  it('requires a tag outside of tag workflows', () => {
    setInput('tag', '');
    vi.stubEnv('GITHUB_REF', 'refs/heads/main');
    expect(() => parseActionInputs()).toThrow(
      'Input required: "tag". It defaults to the tag the workflow runs for (a tag push or a release), but the ref is "refs/heads/main".',
    );
    vi.stubEnv('GITHUB_REF', undefined);
    expect(() => parseActionInputs()).toThrow('but the ref is "".');
  });

  it('accepts a prefix with "@"', () => {
    setInput('prefix', '@scope/name@');
    expect(parseActionInputs().naming.prefix).toBe('@scope/name@');
  });

  it.each(['-pkg/', '/pkg', 'pkg@{', 'pkg..v', 'a b', 'pkg//', '.pkg', 'pkg/.x', 'pkg.lock/'])(
    'rejects the prefix "%s"',
    prefix => {
      setInput('prefix', prefix);
      expect(() => parseActionInputs()).toThrow(
        `Invalid input "prefix": "${prefix}" is not a valid start of a tag name.`,
      );
    },
  );

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
