import { setTimeout as sleep } from 'node:timers/promises';

import { warning } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRateLimitWait, withRateLimitRetry } from './rate-limit.js';

vi.mock('@actions/core', () => ({ warning: vi.fn() }));
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));

const now = 1_700_000_000_000;

/**
 * Creates an HTTP error like Octokit does.
 *
 * @param status - The HTTP status.
 * @param headers - The response headers.
 * @param message - The error message.
 * @returns The error.
 */
function httpError(status: number, headers: Record<string, string> = {}, message = `HTTP ${status}`): Error {
  return Object.assign(new Error(message), { status, response: { headers } });
}

describe('getRateLimitWait', () => {
  it('uses retry-after', () => {
    expect(getRateLimitWait(httpError(403, { 'retry-after': '30' }), now)).toBe(30_000);
    expect(getRateLimitWait(httpError(429, { 'retry-after': '0' }), now)).toBe(0);
  });

  it('waits until the primary rate limit resets', () => {
    const reset = String(now / 1000 + 120);
    expect(getRateLimitWait(httpError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }), now)).toBe(
      121_000,
    );
  });

  it('waits one minute for a secondary rate limit without retry information', () => {
    expect(getRateLimitWait(httpError(403, {}, 'You have exceeded a secondary rate limit'), now)).toBe(60_000);
  });

  it('detects GraphQL rate limits', () => {
    const error = Object.assign(new Error('API rate limit exceeded'), {
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 10) },
      errors: [{ type: 'RATE_LIMITED' }],
    });
    expect(getRateLimitWait(error, now)).toBe(11_000);
  });

  it.each([
    ['a forbidden error without rate limit hints', httpError(403, {}, 'Resource not accessible by integration')],
    ['other statuses', httpError(500, { 'retry-after': '10' })],
    ['plain errors', new Error('rate limit')],
    ['non-errors', 'rate limit'],
    ['null', null],
  ])('ignores %s', (_, error) => {
    expect(getRateLimitWait(error, now)).toBeUndefined();
  });
});

describe('withRateLimitRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the result without retry', async () => {
    const request = vi.fn().mockResolvedValue('ok');
    expect(await withRateLimitRetry('testing', request)).toBe('ok');
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits and retries after a rate limit', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(httpError(403, { 'retry-after': '2' }))
      .mockRejectedValueOnce(httpError(429, { 'retry-after': '3' }))
      .mockResolvedValue('ok');

    expect(await withRateLimitRetry('creating the tag v1.0.0', request)).toBe('ok');
    expect(request).toHaveBeenCalledTimes(3);
    expect(vi.mocked(sleep).mock.calls).toEqual([[2000], [3000]]);
    expect(warning).toHaveBeenCalledWith(
      'Rate limit reached while creating the tag v1.0.0; retrying in 2 seconds (attempt 2 of 5).',
    );
  });

  it('gives up after the maximum number of attempts', async () => {
    const error = httpError(403, { 'retry-after': '1' });
    const request = vi.fn().mockRejectedValue(error);

    await expect(withRateLimitRetry('testing', request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(5);
    expect(sleep).toHaveBeenCalledTimes(4);
  });

  it('fails instead of waiting too long', async () => {
    const request = vi.fn().mockRejectedValue(httpError(403, { 'retry-after': '3600' }));
    await expect(withRateLimitRetry('testing', request)).rejects.toThrow(
      'Rate limit reached while testing; GitHub asks to wait 3600 seconds.',
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry other errors', async () => {
    const error = httpError(422);
    const request = vi.fn().mockRejectedValue(error);
    await expect(withRateLimitRetry('testing', request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
