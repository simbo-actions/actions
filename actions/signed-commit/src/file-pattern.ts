import { posix } from 'node:path';

/**
 * Checks whether a path matches the file patterns.
 *
 * A path matches if it matches at least one pattern without `!` (or there is
 * none) and no pattern with `!`. The order of the patterns does not matter.
 * Patterns are globs like `dist/**` or `*.md`, matched with
 * `path.matchesGlob` against the path relative to the repository root.
 *
 * @param path - The repository path with forward slashes.
 * @param patterns - The patterns; an empty list matches every path.
 * @returns `true` if the path matches.
 */
export function matchesFilePatterns(path: string, patterns: string[]): boolean {
  const includes = patterns.filter(pattern => !pattern.startsWith('!'));
  const excludes = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1));
  return (
    (includes.length === 0 || includes.some(pattern => posix.matchesGlob(path, pattern))) &&
    excludes.every(pattern => !posix.matchesGlob(path, pattern))
  );
}
