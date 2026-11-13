/**
 * The pinned Gitleaks version.
 */
export const GITLEAKS_VERSION = '8.30.1';

/**
 * SHA-256 checksums of the release archives of the pinned version, by
 * platform, from `gitleaks_<version>_checksums.txt` of the release.
 */
export const GITLEAKS_CHECKSUMS: Readonly<Record<string, string>> = {
  darwin_arm64: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
  darwin_x64: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  linux_arm64: 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  linux_x64: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
};

/**
 * The exit code Gitleaks is told to use if it finds leaks. Every other
 * non-zero exit code is an error.
 */
export const EXIT_CODE_LEAKS = 2;

/**
 * Length of an abbreviated commit SHA in the job summary.
 */
export const SHORT_SHA_LENGTH = 7;
