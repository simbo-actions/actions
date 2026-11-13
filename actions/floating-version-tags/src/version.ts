import type { FloatingTag, Version } from './floating-version-tags.types.js';

/**
 * A stable version tag: `v` and three numbers without leading zeros.
 */
const VERSION_TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * A version tag with a prerelease or build suffix, like `v1.2.3-beta.1`.
 */
const SUFFIXED_VERSION_TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)[+-]/;

/**
 * Parses a stable version tag.
 *
 * @param tag - The tag name.
 * @returns The version, or `undefined` if the tag is not a stable version tag.
 */
export function parseVersionTag(tag: string): Version | undefined {
  const match = VERSION_TAG_PATTERN.exec(tag);
  return match ? { tag, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : undefined;
}

/**
 * Parses the release tag input.
 *
 * @param tag - The tag name.
 * @returns The version.
 * @throws {Error} if the tag is a prerelease or not a version tag.
 */
export function parseReleaseTag(tag: string): Version {
  const version = parseVersionTag(tag);
  if (version) {
    return version;
  }
  if (SUFFIXED_VERSION_TAG_PATTERN.test(tag)) {
    throw new Error(
      `Invalid input "tag": "${tag}" is a prerelease or has build metadata; floating tags never point to it.`,
    );
  }
  throw new Error(`Invalid input "tag": "${tag}" (expected a version tag like "v1.2.3").`);
}

/**
 * Compares two versions.
 *
 * @param a - The first version.
 * @param b - The second version.
 * @returns A negative number if `a` is lower, a positive number if `a` is higher, `0` if equal.
 */
export function compareVersions(a: Version, b: Version): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Finds the highest version.
 *
 * @param first - A version.
 * @param others - More versions.
 * @returns The highest version.
 */
export function highestVersion(first: Version, others: Version[]): Version {
  return others.reduce((highest, version) => (compareVersions(version, highest) > 0 ? version : highest), first);
}

/**
 * Gets the floating tags to move for a release.
 *
 * @param release - The released version.
 * @param options - Which floating tags to move.
 * @param options.major - Whether to move `vX`.
 * @param options.minor - Whether to move `vX.Y`.
 * @param options.latest - Whether to move `latest`.
 * @returns The floating tags.
 */
export function getFloatingTags(
  release: Version,
  options: { major: boolean; minor: boolean; latest: boolean },
): FloatingTag[] {
  const tags: FloatingTag[] = [];
  if (options.major) {
    tags.push({ name: `v${release.major}`, includes: ({ major }) => major === release.major });
  }
  if (options.minor) {
    tags.push({
      name: `v${release.major}.${release.minor}`,
      includes: ({ major, minor }) => major === release.major && minor === release.minor,
    });
  }
  if (options.latest) {
    tags.push({ name: 'latest', includes: () => true });
  }
  return tags;
}
