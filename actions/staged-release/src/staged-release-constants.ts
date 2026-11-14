/**
 * Options for marking a release as latest.
 */
export const MAKE_LATEST_OPTIONS = ['true', 'false', 'legacy'] as const;

/**
 * Options for a tag that is already released.
 */
export const IF_RELEASED_OPTIONS = ['error', 'skip'] as const;

/**
 * HTTP status of the GitHub API for a missing resource.
 */
export const HTTP_STATUS_NOT_FOUND = 404;

/**
 * HTTP status of the GitHub API for validation errors, such as an unknown
 * discussion category.
 */
export const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

/**
 * Number of releases per page when listing releases.
 */
export const RELEASES_PER_PAGE = 100;
