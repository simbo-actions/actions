import { describe, expect, it, vi } from 'vitest';

import { getBotUser, toBotUser, type Octokit } from './get-bot-user.js';

/**
 * Creates a fake Octokit client.
 *
 * @param getByUsername - The implementation of `users.getByUsername`.
 * @returns The fake client.
 */
function fakeOctokit(getByUsername: ReturnType<typeof vi.fn>): Octokit {
  return { rest: { users: { getByUsername } } } as unknown as Octokit;
}

/**
 * Creates an HTTP error like Octokit does.
 *
 * @param status - The HTTP status.
 * @returns The error.
 */
function httpError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('toBotUser', () => {
  it('builds the Git identity', () => {
    expect(toBotUser(123, 'my-app[bot]')).toEqual({
      id: 123,
      login: 'my-app[bot]',
      name: 'my-app[bot]',
      email: '123+my-app[bot]@users.noreply.github.com',
      author: 'my-app[bot] <123+my-app[bot]@users.noreply.github.com>',
    });
  });
});

describe('getBotUser', () => {
  it('looks up the bot user', async () => {
    const getByUsername = vi.fn().mockResolvedValue({ data: { id: 42, login: 'my-app[bot]', type: 'Bot' } });

    expect(await getBotUser(fakeOctokit(getByUsername), 'my-app')).toEqual(toBotUser(42, 'my-app[bot]'));
    expect(getByUsername).toHaveBeenCalledWith({ username: 'my-app[bot]' });
  });

  it('uses the login as returned by the API', async () => {
    const getByUsername = vi.fn().mockResolvedValue({ data: { id: 42, login: 'My-App[bot]', type: 'Bot' } });
    expect((await getBotUser(fakeOctokit(getByUsername), 'my-app')).login).toBe('My-App[bot]');
  });

  it('fails for an unknown app', async () => {
    const getByUsername = vi.fn().mockRejectedValue(httpError(404));
    await expect(getBotUser(fakeOctokit(getByUsername), 'missing')).rejects.toThrow(
      'No bot user found for the app slug "missing" (missing[bot]).',
    );
  });

  it('fails if the user is not a bot', async () => {
    const getByUsername = vi.fn().mockResolvedValue({ data: { id: 42, login: 'my-app[bot]', type: 'User' } });
    await expect(getBotUser(fakeOctokit(getByUsername), 'my-app')).rejects.toThrow('is not the bot user');
  });

  it('fails if the login does not match', async () => {
    const getByUsername = vi.fn().mockResolvedValue({ data: { id: 42, login: 'other[bot]', type: 'Bot' } });
    await expect(getBotUser(fakeOctokit(getByUsername), 'my-app')).rejects.toThrow('is not the bot user');
  });

  it('passes other errors through', async () => {
    const getByUsername = vi.fn().mockRejectedValue(httpError(500));
    await expect(getBotUser(fakeOctokit(getByUsername), 'my-app')).rejects.toThrow('HTTP 500');
  });
});
