import { summary } from '@actions/core';

import type { UploadedAsset } from './staged-release.types.js';

/**
 * Bytes per kibibyte, for asset sizes.
 */
const BYTES_PER_KIB = 1024;

/**
 * Escapes text for the HTML of the job summary.
 *
 * @param text - The text.
 * @returns The escaped text.
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Formats a file size.
 *
 * @param bytes - The size in bytes.
 * @returns For example `512 B`, `3.4 KiB`, or `1.2 MiB`.
 */
export function formatSize(bytes: number): string {
  if (bytes < BYTES_PER_KIB) {
    return `${bytes} B`;
  }
  const kib = bytes / BYTES_PER_KIB;
  return kib < BYTES_PER_KIB ? `${kib.toFixed(1)} KiB` : `${(kib / BYTES_PER_KIB).toFixed(1)} MiB`;
}

/**
 * Writes the result to the job summary: the release with its state, and the
 * uploaded assets.
 *
 * @param params - The summary parameters.
 * @param params.state - Whether the release was published, left as draft, or skipped because it was already released.
 * @param params.name - The release title.
 * @param params.tag - The tag.
 * @param params.url - The URL of the release page.
 * @param params.labels - Additional labels, for example `prerelease`.
 * @param params.assets - The uploaded assets.
 */
export async function writeSummary(params: {
  state: 'published' | 'draft' | 'skipped';
  name: string;
  tag: string;
  url: string;
  labels: string[];
  assets: UploadedAsset[];
}): Promise<void> {
  const link = `<a href="${params.url}">${escapeHtml(params.name)}</a>`;
  const tag = `<code>${escapeHtml(params.tag)}</code>`;
  const labels = params.labels.length > 0 ? ` · ${params.labels.join(' · ')}` : '';
  const status = {
    published: `✅ Published ${link} for ${tag}${labels}`,
    draft: `📝 Draft ${link} for ${tag}${labels}, not published`,
    skipped: `ℹ️ ${tag} is already released: ${link}; nothing changed`,
  }[params.state];
  summary.addHeading('📦 Staged Release', 2).addRaw(status, true);
  if (params.assets.length > 0) {
    summary.addTable([
      [
        { data: 'Asset', header: true },
        { data: 'Size', header: true },
      ],
      ...params.assets.map(({ name, size, url }) => [`<a href="${url}">${escapeHtml(name)}</a>`, formatSize(size)]),
    ]);
  }
  await summary.write();
}
