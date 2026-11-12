import { setTimeout as sleep } from 'node:timers/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRateLimitWait, withRateLimitRetry } from './rate-limit.ts';
import { fakeCore, httpError } from './test-helpers.ts';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));

const now = 1_700_000_000_000;

describe('getRateLimitWait', () => {
  it('uses retry-after', () => {
    expect(getRateLimitWait(httpError(403, { 'retry-after': '30' }), now)).toBe(30_000);
  });

  it('waits until the primary rate limit resets', () => {
    const reset = String(now / 1000 + 120);
    expect(getRateLimitWait(httpError(429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }), now)).toBe(
      121_000,
    );
  });

  it('waits one minute without retry information', () => {
    expect(getRateLimitWait(httpError(403, {}, 'You have exceeded a secondary rate limit'), now)).toBe(60_000);
  });

  it('detects GraphQL rate limits', () => {
    const error = Object.assign(new Error('limited'), { headers: {}, errors: [{ type: 'RATE_LIMITED' }] });
    expect(getRateLimitWait(error, now)).toBe(60_000);
  });

  it.each([
    ['forbidden errors without hints', httpError(403, {}, 'Resource not accessible by integration')],
    ['other statuses', httpError(500, { 'retry-after': '10' })],
    ['plain errors', new Error('rate limit')],
    ['non-objects', 'rate limit'],
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
    const core = fakeCore();
    expect(await withRateLimitRetry(core, 'testing', async () => 'ok')).toBe('ok');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits and retries after a rate limit', async () => {
    const core = fakeCore();
    const request = vi
      .fn()
      .mockRejectedValueOnce(httpError(403, { 'retry-after': '2' }))
      .mockResolvedValue('ok');

    expect(await withRateLimitRetry(core, 'creating the release', request)).toBe('ok');
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(core.warning).toHaveBeenCalledWith(
      'Rate limit reached while creating the release; retrying in 2 seconds (attempt 2 of 5).',
    );
  });

  it('gives up after the maximum number of attempts', async () => {
    const error = httpError(403, { 'retry-after': '1' });
    const request = vi.fn().mockRejectedValue(error);
    await expect(withRateLimitRetry(fakeCore(), 'testing', request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(5);
  });

  it('fails instead of waiting too long', async () => {
    const request = vi.fn().mockRejectedValue(httpError(403, { 'retry-after': '3600' }));
    await expect(withRateLimitRetry(fakeCore(), 'testing', request)).rejects.toThrow(
      'GitHub asks to wait 3600 seconds',
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry other errors', async () => {
    const error = httpError(422);
    const request = vi.fn().mockRejectedValue(error);
    await expect(withRateLimitRetry(fakeCore(), 'testing', request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
