import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs, parseAppSlug } from './action-inputs.js';

describe('parseAppSlug', () => {
  it.each([
    ['my-app', 'my-app'],
    ['my-app[bot]', 'my-app'],
    [' My-App2[BOT] ', 'My-App2'],
    ['a', 'a'],
  ])('accepts "%s"', (input, expected) => {
    expect(parseAppSlug(input)).toBe(expected);
  });

  it.each(['', '[bot]', '-app', 'app-', 'my--app', 'my_app', 'my app', 'owner/app', 'app[bot]x'])(
    'rejects "%s"',
    input => {
      expect(() => parseAppSlug(input)).toThrow('Invalid input "app-slug"');
    },
  );
});

describe('parseActionInputs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses the inputs', () => {
    vi.stubEnv('INPUT_APP-SLUG', 'my-app[bot]');
    vi.stubEnv('INPUT_TOKEN', 'token');
    expect(parseActionInputs()).toEqual({ appSlug: 'my-app', token: 'token' });
  });

  it('requires the app slug and the token', () => {
    vi.stubEnv('INPUT_TOKEN', 'token');
    expect(() => parseActionInputs()).toThrow('app-slug');
    vi.stubEnv('INPUT_APP-SLUG', 'my-app');
    vi.stubEnv('INPUT_TOKEN', '');
    expect(() => parseActionInputs()).toThrow('token');
  });
});
