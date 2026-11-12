/**
 * Options for marking a release as latest.
 */
export const MAKE_LATEST_OPTIONS = ['true', 'false', 'legacy'] as const;

/**
 * HTTP status of the GitHub API for a missing resource.
 */
export const HTTP_STATUS_NOT_FOUND = 404;

/**
 * Number of releases per page when listing releases.
 */
export const RELEASES_PER_PAGE = 100;
