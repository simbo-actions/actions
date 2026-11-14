import { beforeEach, describe, expect, it, vi } from 'vitest';

import { escapeHtml, formatSize, writeSummary } from './summary.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), addTable: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw, fake.addTable]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ summary }));

const params = {
  state: 'published' as const,
  name: 'Release <1>',
  tag: 'v1.0.0',
  url: 'https://release',
  labels: ['latest'],
  assets: [{ name: 'a.tar.gz', size: 3584, url: 'https://download' }],
};

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">it's & more</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; more&lt;/a&gt;');
  });
});

describe('formatSize', () => {
  it('formats bytes, kibibytes, and mebibytes', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(3584)).toBe('3.5 KiB');
    expect(formatSize(1_258_291)).toBe('1.2 MiB');
  });
});

describe('writeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links the published release and lists the assets', async () => {
    await writeSummary(params);
    expect(summary.addHeading).toHaveBeenCalledWith('📦 Staged Release', 2);
    expect(summary.addRaw).toHaveBeenCalledWith(
      '✅ Published <a href="https://release">Release &lt;1&gt;</a> for <code>v1.0.0</code> · latest',
      true,
    );
    expect(summary.addTable).toHaveBeenCalledWith([
      expect.any(Array),
      ['<a href="https://download">a.tar.gz</a>', '3.5 KiB'],
    ]);
    expect(summary.write).toHaveBeenCalled();
  });

  it('reports a draft', async () => {
    await writeSummary({ ...params, state: 'draft', labels: [], assets: [] });
    expect(summary.addRaw).toHaveBeenCalledWith(
      '📝 Draft <a href="https://release">Release &lt;1&gt;</a> for <code>v1.0.0</code>, not published',
      true,
    );
    expect(summary.addTable).not.toHaveBeenCalled();
  });

  it('reports a skipped release', async () => {
    await writeSummary({ ...params, state: 'skipped', labels: [], assets: [] });
    expect(summary.addRaw).toHaveBeenCalledWith(
      'ℹ️ <code>v1.0.0</code> is already released: <a href="https://release">Release &lt;1&gt;</a>; nothing changed',
      true,
    );
  });
});
