import { readFile } from 'node:fs/promises';
import { cwd } from 'node:process';

import { setOutput, warning } from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { installGitleaks } from './install-gitleaks.js';
import { main } from './main.js';
import { annotateFindings, parseSarifReport, writeSummary } from './report.js';
import { isShallowRepository, runGitleaks } from './run-gitleaks.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn(), warning: vi.fn() }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./install-gitleaks.js', () => ({ installGitleaks: vi.fn() }));
vi.mock('./report.js', () => ({ annotateFindings: vi.fn(), parseSarifReport: vi.fn(), writeSummary: vi.fn() }));
vi.mock('./run-gitleaks.js', () => ({ isShallowRepository: vi.fn(), runGitleaks: vi.fn() }));

const finding = { rule: 'github-pat', file: 'a.ts', line: 1, commit: 'abc' };

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RUNNER_TEMP', '/runner/temp');
    vi.stubEnv('GITHUB_WORKSPACE', '/workspace');
    vi.mocked(parseActionInputs).mockReturnValue({ workingDirectory: '.', config: '' });
    vi.mocked(installGitleaks).mockResolvedValue('/bin/gitleaks');
    vi.mocked(isShallowRepository).mockResolvedValue(false);
    vi.mocked(runGitleaks).mockResolvedValue(false);
    vi.mocked(readFile).mockResolvedValue('{}');
    vi.mocked(parseSarifReport).mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scans and reports a clean history', async () => {
    await main();
    expect(runGitleaks).toHaveBeenCalledWith('/bin/gitleaks', {
      workingDirectory: '.',
      config: '',
      reportPath: '/runner/temp/gitleaks.sarif',
    });
    expect(readFile).toHaveBeenCalledWith('/runner/temp/gitleaks.sarif', 'utf8');
    expect(annotateFindings).toHaveBeenCalledWith([], '.', '/workspace');
    expect(writeSummary).toHaveBeenCalledWith([], expect.any(String));
    expect(vi.mocked(setOutput).mock.calls).toEqual([
      ['findings', '0'],
      ['sarif-file', '/runner/temp/gitleaks.sarif'],
    ]);
    expect(warning).not.toHaveBeenCalled();
  });

  it('fails with findings after reporting them', async () => {
    vi.mocked(runGitleaks).mockResolvedValue(true);
    vi.mocked(parseSarifReport).mockReturnValue([finding]);
    await expect(main()).rejects.toThrow('Gitleaks found 1 potential secret(s).');
    expect(annotateFindings).toHaveBeenCalledWith([finding], '.', '/workspace');
    expect(setOutput).toHaveBeenCalledWith('findings', '1');
  });

  it('fails if Gitleaks reports leaks without results', async () => {
    vi.mocked(runGitleaks).mockResolvedValue(true);
    await expect(main()).rejects.toThrow('Gitleaks found 0 potential secret(s).');
  });

  it('warns about a shallow clone', async () => {
    vi.mocked(isShallowRepository).mockResolvedValue(true);
    await main();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('shallow clone'));
  });

  it('falls back to the temporary directory and the current directory', async () => {
    vi.stubEnv('RUNNER_TEMP', undefined);
    vi.stubEnv('GITHUB_WORKSPACE', undefined);
    await main();
    expect(vi.mocked(runGitleaks).mock.calls[0][1].reportPath).toMatch(/gitleaks\.sarif$/);
    expect(vi.mocked(annotateFindings).mock.calls[0][2]).toBe(cwd());
  });
});
