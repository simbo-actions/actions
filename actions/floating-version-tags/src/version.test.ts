import { describe, expect, it } from 'vitest';

import type { Version } from './floating-version-tags.types.js';
import {
  compareVersions,
  getFloatingTags,
  highestVersion,
  parseReleaseTag,
  parseVersionTag,
  tagMessage,
  versionPrefix,
} from './version.js';

const naming = { prefix: '', vPrefix: true };

const v = (tag: string): Version => parseReleaseTag(tag, naming);

describe('parseVersionTag', () => {
  it('parses stable version tags', () => {
    expect(parseVersionTag('v1.2.3', naming)).toEqual({ tag: 'v1.2.3', major: 1, minor: 2, patch: 3 });
    expect(parseVersionTag('v0.0.0', naming)).toEqual({ tag: 'v0.0.0', major: 0, minor: 0, patch: 0 });
    expect(parseVersionTag('v10.20.30', naming)).toEqual({ tag: 'v10.20.30', major: 10, minor: 20, patch: 30 });
  });

  it.each(['v1', 'v1.2', '1.2.3', 'v01.2.3', 'v1.2.3-beta.1', 'v1.2.3+build', 'latest', 'v1.2.3.4'])(
    'ignores "%s"',
    tag => {
      expect(parseVersionTag(tag, naming)).toBeUndefined();
    },
  );
});

describe('parseReleaseTag', () => {
  it('parses tags with a prefix or without "v"', () => {
    expect(parseVersionTag('pkg/v1.2.3', { prefix: 'pkg/', vPrefix: true })?.major).toBe(1);
    expect(parseVersionTag('1.2.3', { prefix: '', vPrefix: false })?.minor).toBe(2);
    expect(parseVersionTag('v1.2.3', { prefix: 'pkg/', vPrefix: true })).toBeUndefined();
    expect(parseVersionTag('pkgXv1.2.3', { prefix: 'pkg.', vPrefix: true })).toBeUndefined();
  });

  it('names the expected format in errors', () => {
    expect(() => parseReleaseTag('v1.2.3', { prefix: 'pkg/', vPrefix: false })).toThrow(
      '(expected a version tag like "pkg/1.2.3")',
    );
    expect(() => parseReleaseTag('pkg/1.2.3-rc.1', { prefix: 'pkg/', vPrefix: false })).toThrow('is a prerelease');
  });

  it('returns the version', () => {
    expect(parseReleaseTag('v2.0.1', naming)).toEqual({ tag: 'v2.0.1', major: 2, minor: 0, patch: 1 });
  });

  it.each(['v1.2.3-beta.1', 'v1.2.3+build.5'])('rejects the prerelease or build "%s"', tag => {
    expect(() => parseReleaseTag(tag, naming)).toThrow(`"${tag}" is a prerelease or has build metadata`);
  });

  it.each(['v1', '1.2.3', 'main', ''])('rejects the invalid tag "%s"', tag => {
    expect(() => parseReleaseTag(tag, naming)).toThrow(
      `Invalid input "tag": "${tag}" (expected a version tag like "v1.2.3").`,
    );
  });
});

describe('compareVersions', () => {
  it('compares major, minor, and patch numerically', () => {
    expect(compareVersions(v('v2.0.0'), v('v1.9.9'))).toBeGreaterThan(0);
    expect(compareVersions(v('v1.10.0'), v('v1.9.0'))).toBeGreaterThan(0);
    expect(compareVersions(v('v1.0.2'), v('v1.0.10'))).toBeLessThan(0);
    expect(compareVersions(v('v1.2.3'), v('v1.2.3'))).toBe(0);
  });
});

describe('highestVersion', () => {
  it('returns the highest version', () => {
    expect(highestVersion(v('v1.0.0'), [v('v1.2.0'), v('v1.10.0'), v('v1.9.9')]).tag).toBe('v1.10.0');
  });

  it('returns the first version if it is the highest or the only one', () => {
    expect(highestVersion(v('v2.0.0'), [v('v1.0.0')]).tag).toBe('v2.0.0');
    expect(highestVersion(v('v2.0.0'), []).tag).toBe('v2.0.0');
  });
});

describe('getFloatingTags', () => {
  const release = v('v1.2.3');

  it('returns the enabled floating tags', () => {
    const names = (options: { major: boolean; minor: boolean; latest: boolean }): string[] =>
      getFloatingTags(release, { naming, ...options }).map(({ name }) => name);
    expect(names({ major: true, minor: false, latest: false })).toEqual(['v1']);
    expect(names({ major: true, minor: true, latest: true })).toEqual(['v1', 'v1.2', 'latest']);
    expect(names({ major: false, minor: false, latest: false })).toEqual([]);
  });

  it('limits every floating tag to its line', () => {
    const [major, minor, latest] = getFloatingTags(release, { naming, major: true, minor: true, latest: true });
    expect(major.includes(v('v1.9.0'))).toBe(true);
    expect(major.includes(v('v2.0.0'))).toBe(false);
    expect(minor.includes(v('v1.2.9'))).toBe(true);
    expect(minor.includes(v('v1.3.0'))).toBe(false);
    expect(minor.includes(v('v2.2.0'))).toBe(false);
    expect(latest.includes(v('v9.0.0'))).toBe(true);
  });
});

describe('versionPrefix', () => {
  it('combines the prefix and "v"', () => {
    expect(versionPrefix({ prefix: 'pkg/', vPrefix: true })).toBe('pkg/v');
    expect(versionPrefix({ prefix: '', vPrefix: false })).toBe('');
  });
});

describe('floating tags with a prefix', () => {
  it('names them like the release tags', () => {
    const release = parseReleaseTag('pkg/1.2.3', { prefix: 'pkg/', vPrefix: false });
    const tags = getFloatingTags(release, {
      naming: { prefix: 'pkg/', vPrefix: false },
      major: true,
      minor: true,
      latest: true,
    });
    expect(tags.map(({ name }) => name)).toEqual(['pkg/1', 'pkg/1.2', 'pkg/latest']);
  });
});

describe('tagMessage', () => {
  it('describes what the floating tag points to', () => {
    const release = v('v1.4.2');
    const [major, minor, latest] = getFloatingTags(release, { naming, major: true, minor: true, latest: true });
    expect(tagMessage(major, release)).toBe('v1 → v1.4.2 (latest stable release of major version 1)');
    expect(tagMessage(minor, release)).toBe('v1.4 → v1.4.2 (latest stable release of version 1.4)');
    expect(tagMessage(latest, release)).toBe('latest → v1.4.2 (latest stable release)');
  });
});
