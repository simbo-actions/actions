import { setTimeout as sleep } from 'node:timers/promises';

import {
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  RATE_LIMIT_DEFAULT_WAIT_MS,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_MAX_WAIT_MS,
} from './constants.ts';
import type { Core } from './github-script.types.ts';

/**
 * Milliseconds per second.
 */
const MS_PER_SECOND = 1000;

/**
 * The parts of an Octokit error relevant for rate limits.
 */
interface ErrorLike {
  status?: number;
  message?: string;
  headers?: Record<string, string | number | undefined>;
  response?: { headers?: Record<string, string | number | undefined> };
  errors?: { type?: string }[];
}

/**
 * Checks whether an error reports a rate limit.
 *
 * @param error - The error of the request.
 * @param hint - Whether the response contains rate limit information.
 * @returns `true` for a GraphQL rate limit or an HTTP 403/429 with rate limit information.
 */
function isRateLimit(error: ErrorLike, hint: boolean): boolean {
  const graphql = error.errors?.some(({ type }) => type === 'RATE_LIMITED') ?? false;
  const http = error.status === HTTP_STATUS_FORBIDDEN || error.status === HTTP_STATUS_TOO_MANY_REQUESTS;
  return graphql || (http && hint);
}

/**
 * Reads the rate limit headers of an error response.
 *
 * @param error - The error of the request.
 * @returns `retry-after` and `x-ratelimit-reset` as numbers (`NaN` if missing), `x-ratelimit-remaining` as string.
 */
function readRateLimitHeaders(error: ErrorLike): { retryAfter: number; remaining: string; reset: number } {
  const headers = error.response?.headers ?? error.headers ?? {};
  return {
    retryAfter: Number(headers['retry-after']),
    remaining: String(headers['x-ratelimit-remaining']),
    reset: Number(headers['x-ratelimit-reset']),
  };
}

/**
 * Determines how long to wait before retrying a request that hit a rate limit.
 *
 * @param error - The error of the request.
 * @param now - The current time in milliseconds.
 * @returns The wait time in milliseconds, or `undefined` if the error is not a rate limit.
 */
export function getRateLimitWait(error: unknown, now: number): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const errorLike: ErrorLike = error;
  const { retryAfter, remaining, reset } = readRateLimitHeaders(errorLike);
  const hint = Number.isFinite(retryAfter) || remaining === '0' || /rate limit/i.test(errorLike.message ?? '');

  if (!isRateLimit(errorLike, hint)) {
    return undefined;
  }
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return retryAfter * MS_PER_SECOND;
  }
  return remaining === '0' && Number.isFinite(reset)
    ? Math.max(0, reset * MS_PER_SECOND - now) + MS_PER_SECOND
    : RATE_LIMIT_DEFAULT_WAIT_MS;
}

/**
 * Runs an API request and retries it when GitHub reports a rate limit,
 * waiting as long as GitHub asks for.
 *
 * @param core - The `@actions/core` module.
 * @param description - What the request does, for log messages.
 * @param request - The request to run.
 * @returns The result of the request.
 * @throws {Error} if the request fails for another reason, the rate limit
 * persists after all attempts, or GitHub asks to wait longer than allowed.
 */
export async function withRateLimitRetry<T>(core: Core, description: string, request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const wait = getRateLimitWait(error, Date.now());
      if (wait === undefined || attempt >= RATE_LIMIT_MAX_ATTEMPTS) {
        throw error;
      }
      const seconds = Math.ceil(wait / MS_PER_SECOND);
      if (wait > RATE_LIMIT_MAX_WAIT_MS) {
        throw new Error(`Rate limit reached while ${description}; GitHub asks to wait ${seconds} seconds.`, {
          cause: error,
        });
      }
      core.warning(
        `Rate limit reached while ${description}; retrying in ${seconds} seconds ` +
          `(attempt ${attempt + 1} of ${RATE_LIMIT_MAX_ATTEMPTS}).`,
      );
      await sleep(wait);
    }
  }
}
