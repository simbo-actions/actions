/**
 * Parsed inputs for the floating-version-tags action.
 */
export interface ParsedActionInputs {
  token: string;
  owner: string;
  repo: string;
  tag: string;
  naming: TagNaming;
  major: boolean;
  minor: boolean;
  latest: boolean;
  annotated: boolean;
  dryRun: boolean;
}

/**
 * How version tags are named: `<prefix>v1.2.3`, or `<prefix>1.2.3` without
 * the `v` prefix.
 */
export interface TagNaming {
  /**
   * A prefix before the version, for example `my-package/`; may be empty.
   */
  prefix: string;

  /**
   * Whether versions start with `v`.
   */
  vPrefix: boolean;
}

/**
 * A stable version, parsed from a tag like `v1.2.3`.
 */
export interface Version {
  /**
   * The tag name, for example `v1.2.3` or `my-package/v1.2.3`.
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
   * The line of versions, for the tag message, for example `major version 1`;
   * empty for all versions.
   */
  line: string;

  /**
   * Whether a version belongs to the line of this floating tag.
   */
  includes: (version: Version) => boolean;
}

/**
 * The state of a tag in the repository.
 */
export interface TagState {
  /**
   * The commit SHA the tag points to.
   */
  commit: string;

  /**
   * Whether the tag is an annotated tag object.
   */
  annotated: boolean;
}

/**
 * What happened to a floating tag.
 */
export interface TagResult {
  /**
   * The floating tag name.
   */
  name: string;

  /**
   * Whether the tag was created, moved, replaced by a tag of the other kind,
   * or kept.
   */
  action: 'created' | 'moved' | 'replaced' | 'kept';

  /**
   * Why, for example `v1.3.0 is newer`.
   */
  reason: string;
}
