import { glob, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import type { AssetFile } from './staged-release.types.js';

/**
 * Resolves asset patterns to files. Each pattern is a path or a glob pattern,
 * relative to the working directory.
 *
 * @param patterns - The paths or glob patterns.
 * @param workingDirectory - The directory patterns are resolved against.
 * @returns The files, sorted by name.
 * @throws {Error} if a pattern matches no file, or two files have the same name.
 */
export async function findAssets(patterns: readonly string[], workingDirectory: string): Promise<AssetFile[]> {
  const files = new Map<string, AssetFile>();

  for (const pattern of patterns) {
    let matched = 0;
    const matches = glob(pattern, { cwd: workingDirectory });
    for await (const match of matches) {
      const path = resolve(workingDirectory, match);
      const stats = await stat(path);
      if (!stats.isFile()) {
        continue;
      }
      matched++;
      const name = basename(path);
      const existing = files.get(name);
      if (existing && existing.path !== path) {
        throw new Error(`Two assets have the same name "${name}": ${existing.path} and ${path}`);
      }
      files.set(name, { path, name, size: stats.size });
    }
    if (matched === 0) {
      throw new Error(`No file found for asset pattern "${pattern}".`);
    }
  }

  return [...files.values()].toSorted((a, b) => a.name.localeCompare(b.name));
}
