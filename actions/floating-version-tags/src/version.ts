import type { FloatingTag, TagNaming, Version } from './floating-version-tags.types.js';

/**
 * Three numbers without leading zeros.
 */
const VERSION_PATTERN = String.raw`(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)`;

/**
 * Escapes text for a regular expression.
 *
 * @param text - The text.
 * @returns The escaped text.
 */
function escapeRegExp(text: string): string {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
}

/**
 * Gets the part of a tag name before the version numbers.
 *
 * @param naming - How version tags are named.
 * @returns For example `v` or `my-package/v`.
 */
export function versionPrefix(naming: TagNaming): string {
  return `${naming.prefix}${naming.vPrefix ? 'v' : ''}`;
}

/**
 * Parses a stable version tag.
 *
 * @param tag - The tag name.
 * @param naming - How version tags are named.
 * @returns The version, or `undefined` if the tag is not a stable version tag.
 */
export function parseVersionTag(tag: string, naming: TagNaming): Version | undefined {
  const pattern = new RegExp(`^${escapeRegExp(versionPrefix(naming))}${VERSION_PATTERN}$`);
  const match = pattern.exec(tag);
  return match ? { tag, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : undefined;
}

/**
 * Parses the release tag input.
 *
 * @param tag - The tag name.
 * @param naming - How version tags are named.
 * @returns The version.
 * @throws {Error} if the tag is a prerelease or not a version tag of the naming.
 */
export function parseReleaseTag(tag: string, naming: TagNaming): Version {
  const version = parseVersionTag(tag, naming);
  if (version) {
    return version;
  }
  const prefix = versionPrefix(naming);
  const suffixed = new RegExp(`^${escapeRegExp(prefix)}${VERSION_PATTERN}[+-]`);
  if (suffixed.test(tag)) {
    throw new Error(
      `Invalid input "tag": "${tag}" is a prerelease or has build metadata; floating tags never point to it.`,
    );
  }
  throw new Error(`Invalid input "tag": "${tag}" (expected a version tag like "${prefix}1.2.3").`);
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
 * @param options - Which floating tags to move, and how they are named.
 * @param options.naming - How version tags are named.
 * @param options.major - Whether to move `vX`.
 * @param options.minor - Whether to move `vX.Y`.
 * @param options.latest - Whether to move `latest`.
 * @returns The floating tags.
 */
export function getFloatingTags(
  release: Version,
  options: { naming: TagNaming; major: boolean; minor: boolean; latest: boolean },
): FloatingTag[] {
  const prefix = versionPrefix(options.naming);
  const tags: FloatingTag[] = [];
  if (options.major) {
    tags.push({
      name: `${prefix}${release.major}`,
      line: `major version ${release.major}`,
      includes: ({ major }) => major === release.major,
    });
  }
  if (options.minor) {
    tags.push({
      name: `${prefix}${release.major}.${release.minor}`,
      line: `version ${release.major}.${release.minor}`,
      includes: ({ major, minor }) => major === release.major && minor === release.minor,
    });
  }
  if (options.latest) {
    tags.push({ name: `${options.naming.prefix}latest`, line: '', includes: () => true });
  }
  return tags;
}

/**
 * Gets the message of an annotated floating tag.
 *
 * @param floating - The floating tag.
 * @param release - The released version it points to.
 * @returns For example `v1 → v1.4.2 (latest stable release of major version 1)`.
 */
export function tagMessage(floating: FloatingTag, release: Version): string {
  return `${floating.name} → ${release.tag} (latest stable release${floating.line ? ` of ${floating.line}` : ''})`;
}
