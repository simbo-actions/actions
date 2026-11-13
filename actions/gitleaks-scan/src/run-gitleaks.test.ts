import { exec } from '@actions/exec';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScanTarget } from './gitleaks-scan.types.js';
import { runGitleaks } from './run-gitleaks.js';

vi.mock('@actions/exec', () => ({ exec: vi.fn() }));

const history: ScanTarget = { mode: 'git', logOpts: '', description: 'history' };
const params = { workingDirectory: 'repo', config: '', baselinePath: '', reportPath: '/tmp/gitleaks.sarif' };

describe('runGitleaks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exec).mockResolvedValue(0);
  });

  it('scans the history with redacted secrets and a SARIF report', async () => {
    expect(await runGitleaks('/bin/gitleaks', history, params)).toBe(false);
    expect(exec).toHaveBeenCalledWith(
      '/bin/gitleaks',
      [
        'git',
        '--redact',
        '--no-banner',
        '--report-format',
        'sarif',
        '--report-path',
        '/tmp/gitleaks.sarif',
        '--exit-code',
        '2',
        '.',
      ],
      { cwd: 'repo', ignoreReturnCode: true },
    );
  });

  it('scans the selected commits', async () => {
    await runGitleaks('/bin/gitleaks', { mode: 'git', logOpts: 'a..b', description: '' }, params);
    expect(vi.mocked(exec).mock.calls[0][1]).toEqual(expect.arrayContaining(['--log-opts=a..b']));
  });

  it('scans the files of the working tree', async () => {
    await runGitleaks('/bin/gitleaks', { mode: 'dir', logOpts: '', description: 'files' }, params);
    expect(vi.mocked(exec).mock.calls[0][1]?.[0]).toBe('dir');
  });

  it('passes a configuration file and a baseline', async () => {
    await runGitleaks('/bin/gitleaks', history, { ...params, config: 'gitleaks.toml', baselinePath: 'baseline.json' });
    expect(vi.mocked(exec).mock.calls[0][1]).toEqual(
      expect.arrayContaining(['--config', 'gitleaks.toml', '--baseline-path', 'baseline.json']),
    );
  });

  it('reports leaks', async () => {
    vi.mocked(exec).mockResolvedValue(2);
    expect(await runGitleaks('/bin/gitleaks', history, params)).toBe(true);
  });

  it('fails for other exit codes', async () => {
    vi.mocked(exec).mockResolvedValue(1);
    await expect(runGitleaks('/bin/gitleaks', history, params)).rejects.toThrow('Gitleaks failed with exit code 1');
  });
});
