import { warning } from '@actions/core';
import { getOctokit } from '@actions/github';
import { throttling } from '@octokit/plugin-throttling';

/**
 * An authenticated Octokit client with rate limit handling.
 */
export type Octokit = ReturnType<typeof getOctokit>;

/**
 * Maximum number of retries of a request that hits a rate limit.
 */
export const RATE_LIMIT_MAX_RETRIES = 4;

/**
 * The parts of a request description used in log messages.
 */
interface RequestOptions {
  method: string;
  url: string;
}

/**
 * Decides whether to retry a request that hit a rate limit, and logs a warning.
 *
 * @param kind - The kind of rate limit, for the log message.
 * @param retryAfter - The seconds GitHub asks to wait.
 * @param options - The request.
 * @param retryCount - The number of retries so far.
 * @returns `true` to retry after the wait time.
 */
export function shouldRetryOnRateLimit(
  kind: 'primary' | 'secondary',
  retryAfter: number,
  options: RequestOptions,
  retryCount: number,
): boolean {
  const request = `${options.method} ${options.url}`;
  if (retryCount >= RATE_LIMIT_MAX_RETRIES) {
    warning(`The ${kind} rate limit persists for ${request}; giving up after ${retryCount} retries.`);
    return false;
  }
  warning(
    `The ${kind} rate limit was reached for ${request}; retrying in ${retryAfter} seconds ` +
      `(retry ${retryCount + 1} of ${RATE_LIMIT_MAX_RETRIES}).`,
  );
  return true;
}

/**
 * Creates an authenticated Octokit client that waits and retries when GitHub
 * reports a rate limit, using the official plugin `@octokit/plugin-throttling`.
 *
 * @param token - The token to authenticate with.
 * @returns The Octokit client.
 */
export function createOctokit(token: string): Octokit {
  return getOctokit(
    token,
    {
      throttle: {
        onRateLimit: (retryAfter: number, options: RequestOptions, _octokit: unknown, retryCount: number) =>
          shouldRetryOnRateLimit('primary', retryAfter, options, retryCount),
        onSecondaryRateLimit: (retryAfter: number, options: RequestOptions, _octokit: unknown, retryCount: number) =>
          shouldRetryOnRateLimit('secondary', retryAfter, options, retryCount),
      },
    },
    throttling,
  );
}
