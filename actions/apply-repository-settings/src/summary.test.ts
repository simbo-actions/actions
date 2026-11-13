import { beforeEach, describe, expect, it, vi } from 'vitest';

import { changesCount, escapeHtml, writeSummary } from './summary.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), addTable: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw, fake.addTable]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ summary }));

const changes = [
  { setting: 'repository.has_issues', change: 'true → false' },
  { setting: 'label "<bug>"', change: 'create' },
];

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">it's & more</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; more&lt;/a&gt;');
  });
});

describe('changesCount', () => {
  it('uses the singular for one change', () => {
    expect(changesCount(1)).toBe('1 change');
    expect(changesCount(2)).toBe('2 changes');
  });
});

describe('writeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the applied changes', async () => {
    await writeSummary(changes, { repository: 'o/r', dryRun: false });
    expect(summary.addHeading).toHaveBeenCalledWith('⚙️ Repository Settings', 2);
    expect(summary.addRaw).toHaveBeenCalledWith('✅ Applied 2 changes to <code>o/r</code>.', true);
    expect(summary.addTable).toHaveBeenCalledWith([
      expect.any(Array),
      ['<code>repository.has_issues</code>', 'true → false'],
      ['<code>label &quot;&lt;bug&gt;&quot;</code>', 'create'],
    ]);
    expect(summary.write).toHaveBeenCalled();
  });

  it('marks a dry run', async () => {
    await writeSummary(changes.slice(0, 1), { repository: 'o/r', dryRun: true });
    expect(summary.addRaw).toHaveBeenCalledWith('🧪 Dry run: 1 change to <code>o/r</code> would be applied.', true);
  });

  it('reports that nothing changes', async () => {
    await writeSummary([], { repository: 'o/r', dryRun: true });
    expect(summary.addRaw).toHaveBeenCalledWith('✅ <code>o/r</code> already matches the configuration.', true);
    expect(summary.addTable).not.toHaveBeenCalled();
  });
});
