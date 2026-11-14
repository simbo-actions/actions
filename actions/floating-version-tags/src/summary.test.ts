import { beforeEach, describe, expect, it, vi } from 'vitest';

import { writeSummary } from './summary.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), addTable: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw, fake.addTable]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ summary }));

const params = { repository: 'owner/repo', release: 'v1.2.0', commit: '0123456789abcdef', dryRun: false };

describe('writeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every floating tag with its result', async () => {
    await writeSummary(
      [
        { name: 'v1', action: 'moved', reason: 'to v1.2.0 (annotated)' },
        { name: 'latest', action: 'kept', reason: 'v2.0.0 is newer' },
      ],
      params,
    );
    expect(summary.addHeading).toHaveBeenCalledWith('🏷️ Floating Version Tags', 2);
    expect(summary.addRaw).toHaveBeenCalledWith('✅ 1 of 2 floating tags changed.', true);
    expect(summary.addRaw).toHaveBeenCalledWith(
      '<code>owner/repo</code> · release <code>v1.2.0</code> at <code>0123456</code>',
      true,
    );
    expect(summary.addTable).toHaveBeenCalledWith([
      expect.any(Array),
      ['<code>v1</code>', '✅ moved', 'to v1.2.0 (annotated)'],
      ['<code>latest</code>', '⏸️ kept', 'v2.0.0 is newer'],
    ]);
    expect(summary.write).toHaveBeenCalled();
  });

  it('reports that nothing changed', async () => {
    await writeSummary([{ name: 'v1', action: 'kept', reason: 'already at v1.2.0' }], params);
    expect(summary.addRaw).toHaveBeenCalledWith('ℹ️ 0 of 1 floating tag changed.', true);
  });

  it('marks a dry run', async () => {
    await writeSummary([{ name: 'v1', action: 'created', reason: 'at v1.2.0 (lightweight)' }], {
      ...params,
      dryRun: true,
    });
    expect(summary.addRaw).toHaveBeenCalledWith('🧪 Dry run: 1 of 1 floating tag would change.', true);
    expect(summary.addTable).toHaveBeenCalledWith([
      expect.any(Array),
      ['<code>v1</code>', '🧪 would create', 'at v1.2.0 (lightweight)'],
    ]);
  });
});
