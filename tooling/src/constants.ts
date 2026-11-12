/**
 * Maximum number of attempts for an API request that hits a rate limit.
 */
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * Wait time in milliseconds after a rate limit without retry information.
 * GitHub recommends to wait at least one minute.
 */
export const RATE_LIMIT_DEFAULT_WAIT_MS = 60_000;

/**
 * Longest wait time in milliseconds for a rate limit; longer waits fail instead.
 */
export const RATE_LIMIT_MAX_WAIT_MS = 900_000;

/**
 * HTTP status of the GitHub API for a forbidden request, also used for rate limits.
 */
export const HTTP_STATUS_FORBIDDEN = 403;

/**
 * HTTP status of the GitHub API for a missing resource.
 */
export const HTTP_STATUS_NOT_FOUND = 404;

/**
 * HTTP status of the GitHub API for too many requests.
 */
export const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

/**
 * App ID of the GitHub App "simbo-actions", which publishes the actions.
 */
export const PUBLISHER_APP_ID = 5_701_490;

/**
 * Actor ID of the "Organization admin" role in ruleset bypass lists.
 */
export const ORGANIZATION_ADMIN_ACTOR_ID = 1;

/**
 * Whether published releases are immutable.
 * Off while the release process is introduced; then on for good.
 */
export const IMMUTABLE_RELEASES = false as boolean;

/**
 * Licenses allowed for production dependencies (SPDX identifiers).
 * Only permissive licenses, because dependencies are bundled into the published actions.
 */
export const ALLOWED_LICENSES: readonly string[] = ['0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT'];
