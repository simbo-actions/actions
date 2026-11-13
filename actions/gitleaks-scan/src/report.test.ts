import { error, warning } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Finding } from './gitleaks-scan.types.js';
import { annotateFindings, escapeHtml, parseSarifReport, potentialSecrets, writeSummary } from './report.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), addTable: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw, fake.addTable]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ error: vi.fn(), summary, warning: vi.fn() }));

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

describe('potentialSecrets', () => {
  it('uses the singular for one finding', () => {
    expect(potentialSecrets(1)).toBe('1 potential secret');
    expect(potentialSecrets(0)).toBe('0 potential secrets');
  });
});

describe('annotateFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('annotates every finding as error relative to the workspace', () => {
    annotateFindings([finding], { workingDirectory: '/workspace/repo', workspace: '/workspace', failing: true });
    expect(error).toHaveBeenCalledWith('Potential secret (rule "github-pat") added in commit 0123456789abcdef.', {
      title: 'Gitleaks',
      file: 'repo/src/config.ts',
      startLine: 12,
    });
  });

  it('annotates findings in files as warnings if they do not fail', () => {
    annotateFindings([{ ...finding, commit: '' }], { workingDirectory: '/w', workspace: '/w', failing: false });
    expect(error).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('Potential secret (rule "github-pat") in the working tree.', {
      title: 'Gitleaks',
      file: 'src/config.ts',
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
  const params = { scanned: 'changes a..b (1 commit)', version: '8.0.0', failing: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a clean scan with what was scanned', async () => {
    await writeSummary([], params);
    expect(summary.addRaw).toHaveBeenCalledWith('✅ No potential secrets found.', true);
    expect(summary.addRaw).toHaveBeenCalledWith('<sub>Scanned: changes a..b (1 commit) · Gitleaks 8.0.0</sub>', true);
    expect(summary.addTable).not.toHaveBeenCalled();
    expect(summary.write).toHaveBeenCalled();
  });

  it('lists the findings without secrets or authors', async () => {
    await writeSummary([finding, { ...finding, rule: '<b>', commit: '' }], params);
    expect(summary.addRaw).toHaveBeenCalledWith('❌ <strong>2 potential secrets found.</strong>', true);
    expect(summary.addTable).toHaveBeenCalledWith([
      expect.any(Array),
      ['<code>github-pat</code>', 'src/config.ts', '12', '<code>0123456</code>'],
      ['<code>&lt;b&gt;</code>', 'src/config.ts', '12', '–'],
    ]);
  });

  it('marks findings that do not fail as warning', async () => {
    await writeSummary([finding], { ...params, failing: false });
    expect(summary.addRaw).toHaveBeenCalledWith('⚠️ <strong>1 potential secret found.</strong>', true);
  });
});
