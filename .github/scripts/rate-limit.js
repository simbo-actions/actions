//------------------------------------------------------------------------------
// Rate Limit
//
// Retries GitHub API requests that hit a rate limit, waiting as long as GitHub
// asks for. Same behavior as in the action signed-commit.
//------------------------------------------------------------------------------

import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Maximum number of attempts per request.
 */
const MAX_ATTEMPTS = 5;

/**
 * Wait time without retry information; GitHub recommends at least one minute.
 */
const DEFAULT_WAIT_MS = 60_000;

/**
 * Longest wait time; longer waits fail instead.
 */
const MAX_WAIT_MS = 900_000;

/**
 * Determines how long to wait before retrying a request that hit a rate limit.
 *
 * @param {any} error - The error of the request.
 * @param {number} now - The current time in milliseconds.
 * @returns {number | undefined} The wait time in milliseconds, or `undefined` if the error is not a rate limit.
 */
export function getRateLimitWait(error, now) {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const headers = error.response?.headers ?? error.headers ?? {};
  const retryAfter = Number(headers['retry-after']);
  const remaining = String(headers['x-ratelimit-remaining']);
  const reset = Number(headers['x-ratelimit-reset']);

  const graphqlLimited = error.errors?.some(({ type }) => type === 'RATE_LIMITED') ?? false;
  const httpLimited =
    (error.status === 403 || error.status === 429) &&
    (Number.isFinite(retryAfter) || remaining === '0' || /rate limit/i.test(error.message ?? ''));

  if (!graphqlLimited && !httpLimited) {
    return undefined;
  }
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return retryAfter * 1000;
  }
  return remaining === '0' && Number.isFinite(reset) ? Math.max(0, reset * 1000 - now) + 1000 : DEFAULT_WAIT_MS;
}

/**
 * Runs an API request and retries it when GitHub reports a rate limit.
 *
 * @template T
 * @param {object} core - The `@actions/core` module.
 * @param {string} description - What the request does, for log messages.
 * @param {() => Promise<T>} request - The request to run.
 * @returns {Promise<T>} The result of the request.
 */
export async function withRateLimitRetry(core, description, request) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const wait = getRateLimitWait(error, Date.now());
      if (wait === undefined || attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      if (wait > MAX_WAIT_MS) {
        throw new Error(
          `Rate limit reached while ${description}; GitHub asks to wait ${Math.ceil(wait / 1000)} seconds.`,
          {
            cause: error,
          },
        );
      }
      core.warning(
        `Rate limit reached while ${description}; retrying in ${Math.ceil(wait / 1000)} seconds (attempt ${attempt + 1} of ${MAX_ATTEMPTS}).`,
      );
      await sleep(wait);
    }
  }
}
