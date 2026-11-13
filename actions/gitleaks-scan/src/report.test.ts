import { error } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Finding } from './gitleaks-scan.types.js';
import { annotateFindings, escapeHtml, parseSarifReport, writeSummary } from './report.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), addTable: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw, fake.addTable]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ error: vi.fn(), summary }));

const finding: Finding = { rule: 'github-pat', file: 'src/config.ts', line: 12, commit: '0123456789abcdef' };

describe('parseSarifReport', () => {
  it('reads rule, location, and commit of every result', () => {
    const report = {
      runs: [
        {
          results: [
            {
              ruleId: 'github-pat',
              message: { text: 'REDACTED' },
              locations: [
                { physicalLocation: { artifactLocation: { uri: 'src/config.ts' }, region: { startLine: 12 } } },
              ],
              partialFingerprints: { commitSha: '0123456789abcdef', author: 'someone', email: 'a@b.c' },
            },
          ],
        },
      ],
    };
    expect(parseSarifReport(JSON.stringify(report))).toEqual([finding]);
  });

  it('uses defaults for missing fields', () => {
    expect(parseSarifReport(JSON.stringify({ runs: [{ results: [{}] }, {}] }))).toEqual([
      { rule: 'unknown', file: '', line: 1, commit: '' },
    ]);
  });

  it('returns no findings for an empty report', () => {
    expect(parseSarifReport('{}')).toEqual([]);
  });

  it('fails for invalid JSON', () => {
    expect(() => parseSarifReport('not json')).toThrow(SyntaxError);
  });
});

describe('annotateFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('annotates every finding relative to the workspace', () => {
    annotateFindings([finding], '/workspace/repo', '/workspace');
    expect(error).toHaveBeenCalledWith('Potential secret (rule "github-pat") added in commit 0123456789abcdef.', {
      title: 'Gitleaks',
      file: 'repo/src/config.ts',
      startLine: 12,
    });
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">it's & more</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; more&lt;/a&gt;');
  });
});

describe('writeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a clean scan', async () => {
    await writeSummary([], '8.0.0');
    expect(summary.addRaw).toHaveBeenCalledWith('No potential secrets found (Gitleaks 8.0.0).', true);
    expect(summary.addTable).not.toHaveBeenCalled();
    expect(summary.write).toHaveBeenCalled();
  });

  it('lists the findings without secrets or authors', async () => {
    await writeSummary([finding], '8.0.0');
    expect(summary.addRaw).toHaveBeenCalledWith('1 potential secret(s) found (Gitleaks 8.0.0):', true);
    expect(summary.addTable).toHaveBeenCalledWith([
      expect.any(Array),
      ['github-pat', 'src/config.ts', '12', '0123456'],
    ]);
    expect(summary.write).toHaveBeenCalled();
  });
});
