/**
 * Options for marking a release as latest, as accepted by the GitHub API.
 */
export type MakeLatestOption = 'true' | 'false' | 'legacy';

/**
 * What to do if the tag is already released.
 */
export type IfReleasedOption = 'error' | 'skip';

/**
 * Parsed inputs for the staged-release action.
 */
export interface ParsedActionInputs {
  token: string;
  owner: string;
  repo: string;
  tag: string;
  name: string;
  body: string;
  assetPatterns: string[];
  workingDirectory: string;
  makeLatest: MakeLatestOption;
  prerelease: boolean;
  publish: boolean;
  ifReleased: IfReleasedOption;
}

/**
 * A file to upload as release asset.
 */
export interface AssetFile {
  /**
   * The absolute path of the file.
   */
  path: string;

  /**
   * The asset name: the file name.
   */
  name: string;

  /**
   * The file size in bytes.
   */
  size: number;
}

/**
 * An uploaded release asset.
 */
export interface UploadedAsset {
  name: string;
  size: number;
  url: string;
}
