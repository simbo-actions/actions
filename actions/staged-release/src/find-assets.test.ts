import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findAssets } from './find-assets.js';

describe('findAssets', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'staged-release-assets-'));
    await mkdir(join(directory, 'dist', 'sub'), { recursive: true });
    await writeFile(join(directory, 'dist', 'action-v1.0.0.tar.gz'), 'archive');
    await writeFile(join(directory, 'dist', 'sub', 'other.zip'), 'zip');
    await writeFile(join(directory, 'SHA256SUMS'), 'sums');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('returns nothing without patterns', async () => {
    expect(await findAssets([], directory)).toEqual([]);
  });

  it('resolves paths and glob patterns, sorted by name', async () => {
    expect(await findAssets(['dist/**/*', 'SHA256SUMS'], directory)).toEqual([
      { path: join(directory, 'dist', 'action-v1.0.0.tar.gz'), name: 'action-v1.0.0.tar.gz', size: 7 },
      { path: join(directory, 'dist', 'sub', 'other.zip'), name: 'other.zip', size: 3 },
      { path: join(directory, 'SHA256SUMS'), name: 'SHA256SUMS', size: 4 },
    ]);
  });

  it('accepts the same file from several patterns', async () => {
    expect(await findAssets(['SHA256SUMS', '*SUMS'], directory)).toHaveLength(1);
  });

  it('fails if a pattern matches no file', async () => {
    await expect(findAssets(['missing/*'], directory)).rejects.toThrow('No file found for asset pattern "missing/*"');
    await expect(findAssets(['dist'], directory)).rejects.toThrow('No file found for asset pattern "dist"');
  });

  it('fails for two files with the same name', async () => {
    await writeFile(join(directory, 'dist', 'SHA256SUMS'), 'other');
    await expect(findAssets(['SHA256SUMS', 'dist/SHA256SUMS'], directory)).rejects.toThrow(
      'Two assets have the same name "SHA256SUMS"',
    );
  });
});
