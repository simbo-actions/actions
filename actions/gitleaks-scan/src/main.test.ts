import { access, readFile } from 'node:fs/promises';
import { cwd } from 'node:process';

import { info, setOutput, warning } from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { isShallowRepository } from './git.js';
import type { ParsedActionInputs, ScanTarget } from './gitleaks-scan.types.js';
import { installGitleaks } from './install-gitleaks.js';
import { main } from './main.js';
import { annotateFindings, parseSarifReport, writeSummary } from './report.js';
import { runGitleaks } from './run-gitleaks.js';
import { readWorkflowEvent, resolveScanTarget } from './scan-target.js';

vi.mock('node:fs/promises', () => ({ access: vi.fn(), readFile: vi.fn() }));
vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn(), warning: vi.fn() }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./git.js', () => ({ isShallowRepository: vi.fn() }));
vi.mock('./install-gitleaks.js', () => ({ installGitleaks: vi.fn() }));
vi.mock('./report.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./report.js')>()),
  annotateFindings: vi.fn(),
  parseSarifReport: vi.fn(),
  writeSummary: vi.fn(),
}));
vi.mock('./run-gitleaks.js', () => ({ runGitleaks: vi.fn() }));
vi.mock('./scan-target.js', () => ({ readWorkflowEvent: vi.fn(), resolveScanTarget: vi.fn() }));

const inputs: ParsedActionInputs = {
  workingDirectory: '.',
  scope: 'auto',
  logOpts: '',
  config: '',
  baselinePath: '',
  failOnFindings: true,
};
const changes: ScanTarget = { mode: 'git', logOpts: 'a..b', description: 'changes a..b (1 commit)' };
const history: ScanTarget = { mode: 'git', logOpts: '', description: 'history' };
const finding = { rule: 'github-pat', file: 'a.ts', line: 1, commit: 'abc' };

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RUNNER_TEMP', '/runner/temp');
    vi.stubEnv('GITHUB_WORKSPACE', '/workspace');
    vi.mocked(parseActionInputs).mockReturnValue(inputs);
    vi.mocked(readWorkflowEvent).mockResolvedValue({ name: 'push', payload: {} });
    vi.mocked(resolveScanTarget).mockResolvedValue(changes);
    vi.mocked(installGitleaks).mockResolvedValue('/bin/gitleaks');
    vi.mocked(isShallowRepository).mockResolvedValue(false);
    vi.mocked(runGitleaks).mockResolvedValue(false);
    vi.mocked(readFile).mockResolvedValue('{}');
    vi.mocked(parseSarifReport).mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scans and reports a clean result', async () => {
    await main();
    expect(runGitleaks).toHaveBeenCalledWith('/bin/gitleaks', changes, {
      ...inputs,
      reportPath: '/runner/temp/gitleaks.sarif',
    });
    expect(info).toHaveBeenCalledWith('Scanning changes a..b (1 commit) with Gitleaks 8.30.1.');
    expect(readFile).toHaveBeenCalledWith('/runner/temp/gitleaks.sarif', 'utf8');
    expect(annotateFindings).toHaveBeenCalledWith([], {
      workingDirectory: '.',
      workspace: '/workspace',
      failing: true,
    });
    expect(writeSummary).toHaveBeenCalledWith([], {
      scanned: 'changes a..b (1 commit)',
      version: '8.30.1',
      failing: true,
    });
    expect(vi.mocked(setOutput).mock.calls).toEqual([
      ['scanned', 'changes a..b (1 commit)'],
      ['findings', '0'],
      ['sarif-file', '/runner/temp/gitleaks.sarif'],
    ]);
    expect(isShallowRepository).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });

  it('fails with findings after reporting them', async () => {
    vi.mocked(runGitleaks).mockResolvedValue(true);
    vi.mocked(parseSarifReport).mockReturnValue([finding]);
    await expect(main()).rejects.toThrow('Gitleaks found 1 potential secret. Revoke real secrets first');
    expect(annotateFindings).toHaveBeenCalledWith([finding], expect.objectContaining({ failing: true }));
    expect(setOutput).toHaveBeenCalledWith('findings', '1');
  });

  it('only warns about findings if "fail-on-findings" is false', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, failOnFindings: false });
    vi.mocked(runGitleaks).mockResolvedValue(true);
    vi.mocked(parseSarifReport).mockReturnValue([finding, finding]);
    await main();
    expect(annotateFindings).toHaveBeenCalledWith([finding, finding], expect.objectContaining({ failing: false }));
    expect(warning).toHaveBeenCalledWith(
      'Gitleaks found 2 potential secrets; not failing, because "fail-on-findings" is false.',
    );
  });

  it('fails if Gitleaks reports leaks without results', async () => {
    vi.mocked(runGitleaks).mockResolvedValue(true);
    await expect(main()).rejects.toThrow('Gitleaks found 0 potential secrets.');
  });

  it('warns about a shallow clone when scanning the history', async () => {
    vi.mocked(resolveScanTarget).mockResolvedValue(history);
    vi.mocked(isShallowRepository).mockResolvedValue(true);
    await main();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('shallow clone'));
  });

  it('does not check the repository when scanning files', async () => {
    vi.mocked(resolveScanTarget).mockResolvedValue({ mode: 'dir', logOpts: '', description: 'files' });
    await main();
    expect(isShallowRepository).not.toHaveBeenCalled();
  });

  it('checks that the configuration and the baseline exist', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, config: 'gitleaks.toml', baselinePath: 'baseline.json' });
    await main();
    expect(access).toHaveBeenCalledWith('gitleaks.toml');
    expect(access).toHaveBeenCalledWith('baseline.json');
  });

  it('fails for a missing baseline before installing Gitleaks', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ ...inputs, baselinePath: 'baseline.json' });
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
    await expect(main()).rejects.toThrow('Invalid input "baseline-path": "baseline.json" does not exist in ".".');
    expect(installGitleaks).not.toHaveBeenCalled();
  });

  it('falls back to the temporary directory and the current directory', async () => {
    vi.stubEnv('RUNNER_TEMP', undefined);
    vi.stubEnv('GITHUB_WORKSPACE', undefined);
    await main();
    expect(vi.mocked(runGitleaks).mock.calls[0][2].reportPath).toMatch(/gitleaks\.sarif$/);
    expect(vi.mocked(annotateFindings).mock.calls[0][1].workspace).toBe(cwd());
  });
});
