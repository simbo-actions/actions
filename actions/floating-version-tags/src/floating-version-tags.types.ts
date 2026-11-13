/**
 * Parsed inputs for the floating-version-tags action.
 */
export interface ParsedActionInputs {
  token: string;
  owner: string;
  repo: string;
  tag: string;
  major: boolean;
  minor: boolean;
  latest: boolean;
  dryRun: boolean;
}

/**
 * A stable version, parsed from a tag `vX.Y.Z`.
 */
export interface Version {
  /**
   * The tag name, for example `v1.2.3`.
   */
  tag: string;

  major: number;
  minor: number;
  patch: number;
}

/**
 * A floating tag and the release tags it may point to.
 */
export interface FloatingTag {
  /**
   * The tag name, for example `v1`, `v1.2`, or `latest`.
   */
  name: string;

  /**
   * Whether a version belongs to the line of this floating tag.
   */
  includes: (version: Version) => boolean;
}
