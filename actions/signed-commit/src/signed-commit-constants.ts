/**
 * Options for detecting file changes.
 */
export const DETECT_CHANGES_OPTIONS = ['all', 'staged', 'none'] as const;

/**
 * Options for handling a commit without changes.
 */
export const IF_NO_CHANGES_OPTIONS = ['error', 'warn', 'ignore'] as const;

/**
 * Options for the type of the created tags.
 */
export const TAG_TYPE_OPTIONS = ['annotated', 'lightweight'] as const;

/**
 * Placeholder in `tag-message` that is replaced with the tag name.
 */
export const TAG_MESSAGE_PLACEHOLDER = '{tag}';

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
 * HTTP status of the GitHub API for a missing object, such as a missing reference.
 */
export const HTTP_STATUS_NOT_FOUND = 404;

/**
 * HTTP status of the GitHub API for validation errors, such as an existing reference.
 */
export const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

/**
 * Requests per minute that create content, allowed by GitHub's secondary rate
 * limit; creating more tags than that may slow the action down.
 */
export const CONTENT_CREATION_REQUESTS_PER_MINUTE = 80;
