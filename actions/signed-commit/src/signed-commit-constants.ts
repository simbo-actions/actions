/**
 * Options for detecting file changes.
 */
export const DETECT_CHANGES_OPTIONS = ['all', 'staged', 'none'] as const;

/**
 * Options for handling a commit without changes.
 */
export const IF_NO_CHANGES_OPTIONS = ['error', 'warn', 'ignore'] as const;

/**
 * Special value for `expected-head-oid` to use the current head of the remote branch.
 */
export const EXPECTED_HEAD_OID_REMOTE = 'remote';

/**
 * Git file mode of executable files.
 */
export const GIT_MODE_EXECUTABLE = '100755';

/**
 * Git file mode of symbolic links.
 */
export const GIT_MODE_SYMLINK = '120000';

/**
 * Git file mode of submodules (gitlinks).
 */
export const GIT_MODE_SUBMODULE = '160000';

/**
 * Permission bits that mark a file as executable.
 */
export const EXECUTABLE_PERMISSION_BITS = 0o111;

/**
 * Maximum output size of a Git command in bytes (large enough for file contents).
 */
export const GIT_MAX_BUFFER_BYTES = 1_073_741_824;

/**
 * HTTP status of the GitHub API for validation errors, such as an existing reference.
 */
export const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

/**
 * Number of tags from which GitHub's secondary rate limit for creating content
 * (80 requests per minute) may slow the action down.
 */
export const TAGS_RATE_LIMIT_WARNING_THRESHOLD = 80;
