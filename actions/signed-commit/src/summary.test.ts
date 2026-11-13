import { beforeEach, describe, expect, it, vi } from 'vitest';

import { escapeHtml, writeSummary } from './summary.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ summary }));

const commitOid = '0123456789abcdef0123456789abcdef01234567';
const params = {
  repository: 'owner/repo',
  branch: 'main',
  head: { oid: 'f'.repeat(40) },
  message: { headline: 'feat: <new> & shiny' },
  commitUrl: `https://github.com/owner/repo/commit/${commitOid}`,
  tags: [],
  fileChanges: { additions: [{ path: 'a.txt', contents: '' }], deletions: [{ path: 'b.txt' }] },
};

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">it's & more</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; more&lt;/a&gt;');
  });
});

describe('writeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links the commit and lists headline, tags, and files', async () => {
    await writeSummary({
      ...params,
      commitOid,
      tags: [
        { name: 'v1.0.0', created: true },
        { name: 'v1', created: false },
      ],
    });
    expect(summary.addHeading).toHaveBeenCalledWith('✍️ Signed Commit', 2);
    expect(summary.addRaw).toHaveBeenCalledWith(
      `✅ Verified commit <a href="${params.commitUrl}"><code>0123456</code></a> on <code>owner/repo@main</code>`,
      true,
    );
    expect(summary.addRaw).toHaveBeenCalledWith('<blockquote>feat: &lt;new&gt; &amp; shiny</blockquote>', true);
    expect(summary.addRaw).toHaveBeenCalledWith('🏷️ Tags: <code>v1.0.0</code>, <code>v1</code> (existed)', true);
    expect(summary.addRaw).toHaveBeenCalledWith(
      '<details><summary>Files: 1 added or changed, 1 deleted</summary><pre>+ a.txt\n- b.txt</pre></details>',
      true,
    );
    expect(summary.write).toHaveBeenCalled();
  });

  it('names the base of a new branch', async () => {
    await writeSummary({ ...params, commitOid, head: { oid: 'f'.repeat(40), createdFrom: 'main' }, branch: 'feature' });
    expect(summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining('on <code>owner/repo@feature</code> (new branch from <code>main</code>)'),
      true,
    );
  });

  it('shortens long file lists', async () => {
    const additions = Array.from({ length: 52 }, (_, index) => ({ path: `f${index}`, contents: '' }));
    await writeSummary({ ...params, commitOid, fileChanges: { additions, deletions: [] } });
    expect(summary.addRaw).toHaveBeenCalledWith(expect.stringContaining('+ f49\n… and 2 more</pre>'), true);
  });

  it('reports that there was nothing to commit', async () => {
    await writeSummary(params);
    expect(summary.addRaw).toHaveBeenCalledWith(
      'ℹ️ Nothing to commit on <code>owner/repo@main</code> at <code>fffffff</code>.',
      true,
    );
    expect(summary.addRaw).toHaveBeenCalledTimes(1);
  });
});
