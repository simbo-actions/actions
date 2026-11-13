import { warning } from '@actions/core';
import { getOctokit } from '@actions/github';
import { throttling } from '@octokit/plugin-throttling';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOctokit, RATE_LIMIT_MAX_RETRIES, shouldRetryOnRateLimit } from './create-octokit.js';

vi.mock('@actions/core', () => ({ warning: vi.fn() }));
vi.mock('@actions/github', () => ({ getOctokit: vi.fn(() => ({ client: true })) }));

const request = { method: 'POST', url: '/repos/{owner}/{repo}/git/refs' };

describe('shouldRetryOnRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries and warns below the maximum', () => {
    expect(shouldRetryOnRateLimit('secondary', 60, request, 0)).toBe(true);
    expect(warning).toHaveBeenCalledWith(
      'The secondary rate limit was reached for POST /repos/{owner}/{repo}/git/refs; retrying in 60 seconds (retry 1 of 4).',
    );
  });

  it('gives up at the maximum', () => {
    expect(shouldRetryOnRateLimit('primary', 60, request, RATE_LIMIT_MAX_RETRIES)).toBe(false);
    expect(warning).toHaveBeenCalledWith(
      'The primary rate limit persists for POST /repos/{owner}/{repo}/git/refs; giving up after 4 retries.',
    );
  });
});

describe('createOctokit', () => {
  it('creates a client with the throttling plugin and both handlers', () => {
    expect(createOctokit('token')).toEqual({ client: true });
    const [token, options, plugin] = vi.mocked(getOctokit).mock.calls[0];
    expect(token).toBe('token');
    expect(plugin).toBe(throttling);

    const { throttle } = options as {
      throttle: Record<'onRateLimit' | 'onSecondaryRateLimit', (...args: unknown[]) => boolean>;
    };
    expect(throttle.onRateLimit(10, request, {}, 0)).toBe(true);
    expect(throttle.onSecondaryRateLimit(10, request, {}, RATE_LIMIT_MAX_RETRIES)).toBe(false);
  });
});
