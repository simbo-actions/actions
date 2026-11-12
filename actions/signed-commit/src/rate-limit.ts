import { setTimeout as sleep } from 'node:timers/promises';

import { warning } from '@actions/core';

import {
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  RATE_LIMIT_DEFAULT_WAIT_MS,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_MAX_WAIT_MS,
} from './signed-commit-constants.js';

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
 * Rate limit information of a failed request.
 */
interface RateLimitInfo {
  limited: boolean;
  retryAfter: number;
  remaining: string;
  reset: number;
}

/**
 * Reads the rate limit information from an Octokit error.
 *
 * @param error - The error of the request.
 * @returns The rate limit information.
 */
function readRateLimitInfo(error: ErrorLike): RateLimitInfo {
  const headers = error.response?.headers ?? error.headers ?? {};
  const retryAfter = Number(headers['retry-after']);
  const remaining = String(headers['x-ratelimit-remaining']);
  const reset = Number(headers['x-ratelimit-reset']);
  const hint = Number.isFinite(retryAfter) || remaining === '0' || /rate limit/i.test(error.message ?? '');
  return {
    limited: isGraphqlRateLimit(error) || (isRateLimitStatus(error.status) && hint),
    retryAfter,
    remaining,
    reset,
  };
}

/**
 * Checks whether a GraphQL error reports a rate limit.
 *
 * @param error - The error of the request.
 * @returns `true` for a GraphQL error of type `RATE_LIMITED`.
 */
function isGraphqlRateLimit(error: ErrorLike): boolean {
  return error.errors?.some(({ type }) => type === 'RATE_LIMITED') ?? false;
}

/**
 * Checks whether an HTTP status is used by GitHub for rate limits.
 *
 * @param status - The HTTP status.
 * @returns `true` for 403 and 429.
 */
function isRateLimitStatus(status: number | undefined): boolean {
  return status === HTTP_STATUS_FORBIDDEN || status === HTTP_STATUS_TOO_MANY_REQUESTS;
}

/**
 * Determines how long to wait before retrying a request that hit a rate limit.
 *
 * Handles the primary rate limit (`x-ratelimit-remaining: 0`), the secondary
 * rate limit (`retry-after` or the error message), and GraphQL errors of type
 * `RATE_LIMITED`.
 *
 * @param error - The error of the request.
 * @param now - The current time in milliseconds.
 * @returns The wait time in milliseconds, or `undefined` if the error is not a rate limit.
 */
export function getRateLimitWait(error: unknown, now: number): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { limited, retryAfter, remaining, reset } = readRateLimitInfo(error);
  if (!limited) {
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
 * @param description - What the request does, for log messages.
 * @param request - The request to run.
 * @returns The result of the request.
 * @throws {Error} if the request fails for another reason, the rate limit
 * persists after all attempts, or GitHub asks to wait longer than allowed.
 */
export async function withRateLimitRetry<T>(description: string, request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const wait = getRateLimitWait(error, Date.now());
      if (wait === undefined || attempt >= RATE_LIMIT_MAX_ATTEMPTS) {
        throw error;
      }
      if (wait > RATE_LIMIT_MAX_WAIT_MS) {
        throw new Error(
          `Rate limit reached while ${description}; GitHub asks to wait ${Math.ceil(wait / MS_PER_SECOND)} seconds.`,
          { cause: error },
        );
      }
      warning(
        `Rate limit reached while ${description}; retrying in ${Math.ceil(wait / MS_PER_SECOND)} seconds ` +
          `(attempt ${attempt + 1} of ${RATE_LIMIT_MAX_ATTEMPTS}).`,
      );
      await sleep(wait);
    }
  }
}
