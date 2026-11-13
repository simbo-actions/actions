import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cacheDir, downloadTool, extractTar } from '@actions/tool-cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GITLEAKS_CHECKSUMS } from './gitleaks-scan-constants.js';
import { getPlatformKey, installGitleaks, sha256File } from './install-gitleaks.js';

vi.mock('@actions/tool-cache', () => ({ cacheDir: vi.fn(), downloadTool: vi.fn(), extractTar: vi.fn() }));
vi.mock('./gitleaks-scan-constants.js', () => ({
  GITLEAKS_VERSION: '1.2.3',
  GITLEAKS_CHECKSUMS: {} as Record<string, string>,
}));

const content = 'archive content';
const checksum = createHash('sha256').update(content).digest('hex');

describe('getPlatformKey', () => {
  beforeEach(() => {
    Object.assign(GITLEAKS_CHECKSUMS, { linux_x64: 'a', darwin_arm64: 'b' });
  });

  it('returns the key of a supported platform', () => {
    expect(getPlatformKey('linux', 'x64')).toBe('linux_x64');
    expect(getPlatformKey('darwin', 'arm64')).toBe('darwin_arm64');
  });

  it('rejects an unsupported platform', () => {
    expect(() => getPlatformKey('win32', 'x64')).toThrow(
      'Unsupported runner: win32 x64 (supported: linux_x64, darwin_arm64).',
    );
  });
});

describe('installGitleaks', () => {
  let directory: string;
  let archive: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'gitleaks-scan-'));
    archive = join(directory, 'gitleaks.tar.gz');
    await writeFile(archive, content);
    Object.assign(GITLEAKS_CHECKSUMS, { linux_x64: checksum });
    vi.mocked(downloadTool).mockResolvedValue(archive);
    vi.mocked(extractTar).mockResolvedValue('/extracted');
    vi.mocked(cacheDir).mockResolvedValue('/cache/gitleaks/1.2.3/x64');
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it('computes the checksum of a file', async () => {
    expect(await sha256File(archive)).toBe(checksum);
  });

  it('downloads, verifies, and caches the pinned release', async () => {
    expect(await installGitleaks('linux', 'x64')).toBe('/cache/gitleaks/1.2.3/x64/gitleaks');
    expect(downloadTool).toHaveBeenCalledWith(
      'https://github.com/gitleaks/gitleaks/releases/download/v1.2.3/gitleaks_1.2.3_linux_x64.tar.gz',
    );
    expect(extractTar).toHaveBeenCalledWith(archive);
    expect(cacheDir).toHaveBeenCalledWith('/extracted', 'gitleaks', '1.2.3', 'x64');
  });

  it('fails if the checksum does not match, before extracting', async () => {
    Object.assign(GITLEAKS_CHECKSUMS, { linux_x64: 'expected' });
    await expect(installGitleaks('linux', 'x64')).rejects.toThrow(`expected expected, got ${checksum}`);
    expect(extractTar).not.toHaveBeenCalled();
  });

  it('fails for an unsupported platform before downloading', async () => {
    await expect(installGitleaks('win32', 'x64')).rejects.toThrow('Unsupported runner');
    expect(downloadTool).not.toHaveBeenCalled();
  });
});
