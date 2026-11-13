import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cacheDir, downloadTool, extractTar } from '@actions/tool-cache';

import { GITLEAKS_CHECKSUMS, GITLEAKS_VERSION } from './gitleaks-scan-constants.js';

/**
 * Gets the platform key of the release archive for a runner.
 *
 * @param platform - The operating system, like `process.platform`.
 * @param arch - The CPU architecture, like `process.arch`.
 * @returns The platform key, for example `linux_x64`.
 * @throws {Error} if there is no pinned archive for the platform.
 */
export function getPlatformKey(platform: string, arch: string): string {
  const key = `${platform}_${arch}`;
  if (!(key in GITLEAKS_CHECKSUMS)) {
    throw new Error(
      `Unsupported runner: ${platform} ${arch} (supported: ${Object.keys(GITLEAKS_CHECKSUMS).join(', ')}).`,
    );
  }
  return key;
}

/**
 * Computes the SHA-256 checksum of a file.
 *
 * @param path - The file path.
 * @returns The checksum as lowercase hex string.
 */
export async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

/**
 * Downloads the pinned Gitleaks release, verifies its checksum, and adds it
 * to the tool cache.
 *
 * The archive is downloaded and verified on every run, so a tool cache that
 * outlives a job (on self-hosted runners) is never trusted blindly.
 *
 * @param platform - The operating system, like `process.platform`.
 * @param arch - The CPU architecture, like `process.arch`.
 * @returns The path of the Gitleaks binary.
 * @throws {Error} if the platform is not supported or the checksum does not match.
 */
export async function installGitleaks(platform: string, arch: string): Promise<string> {
  const key = getPlatformKey(platform, arch);
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${key}.tar.gz`;
  const archive = await downloadTool(url);
  const checksum = await sha256File(archive);
  if (checksum !== GITLEAKS_CHECKSUMS[key]) {
    throw new Error(`Checksum mismatch for ${url}: expected ${GITLEAKS_CHECKSUMS[key]}, got ${checksum}.`);
  }
  const directory = await cacheDir(await extractTar(archive), 'gitleaks', GITLEAKS_VERSION, arch);
  return join(directory, 'gitleaks');
}
