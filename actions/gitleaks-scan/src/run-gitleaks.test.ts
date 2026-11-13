import { exec, getExecOutput } from '@actions/exec';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isShallowRepository, runGitleaks } from './run-gitleaks.js';

vi.mock('@actions/exec', () => ({ exec: vi.fn(), getExecOutput: vi.fn() }));

const params = { workingDirectory: 'repo', config: '', reportPath: '/tmp/gitleaks.sarif' };

describe('isShallowRepository', () => {
  it.each([
    ['true\n', true],
    ['false\n', false],
  ])('reads "%s" as %s', async (stdout, expected) => {
    vi.mocked(getExecOutput).mockResolvedValue({ exitCode: 0, stdout, stderr: '' });
    expect(await isShallowRepository('repo')).toBe(expected);
    expect(getExecOutput).toHaveBeenCalledWith('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: 'repo',
      silent: true,
    });
  });
});

describe('runGitleaks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scans the history with redacted secrets and a SARIF report', async () => {
    vi.mocked(exec).mockResolvedValue(0);
    expect(await runGitleaks('/bin/gitleaks', params)).toBe(false);
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

  it('passes a configuration file', async () => {
    vi.mocked(exec).mockResolvedValue(0);
    await runGitleaks('/bin/gitleaks', { ...params, config: 'gitleaks.toml' });
    expect(vi.mocked(exec).mock.calls[0][1]).toEqual(expect.arrayContaining(['--config', 'gitleaks.toml']));
  });

  it('reports leaks', async () => {
    vi.mocked(exec).mockResolvedValue(2);
    expect(await runGitleaks('/bin/gitleaks', params)).toBe(true);
  });

  it('fails for other exit codes', async () => {
    vi.mocked(exec).mockResolvedValue(1);
    await expect(runGitleaks('/bin/gitleaks', params)).rejects.toThrow('Gitleaks failed with exit code 1');
  });
});
