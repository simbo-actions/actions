import { exec, getExecOutput } from '@actions/exec';

import { EXIT_CODE_LEAKS } from './gitleaks-scan-constants.js';

/**
 * Checks whether a Git repository is a shallow clone.
 *
 * @param workingDirectory - The repository.
 * @returns `true` if the repository is shallow.
 */
export async function isShallowRepository(workingDirectory: string): Promise<boolean> {
  const { stdout } = await getExecOutput('git', ['rev-parse', '--is-shallow-repository'], {
    cwd: workingDirectory,
    silent: true,
  });
  return stdout.trim() === 'true';
}

/**
 * Runs Gitleaks on the Git history of a repository, with secrets redacted.
 *
 * @param binary - The path of the Gitleaks binary.
 * @param params - The scan parameters.
 * @param params.workingDirectory - The repository to scan.
 * @param params.config - A configuration file, or an empty string for the default.
 * @param params.reportPath - Where to write the SARIF report.
 * @returns Whether Gitleaks found leaks.
 * @throws {Error} if Gitleaks fails.
 */
export async function runGitleaks(
  binary: string,
  params: { workingDirectory: string; config: string; reportPath: string },
): Promise<boolean> {
  const args = [
    'git',
    '--redact',
    '--no-banner',
    '--report-format',
    'sarif',
    '--report-path',
    params.reportPath,
    '--exit-code',
    String(EXIT_CODE_LEAKS),
    ...(params.config ? ['--config', params.config] : []),
    '.',
  ];
  const exitCode = await exec(binary, args, { cwd: params.workingDirectory, ignoreReturnCode: true });
  if (exitCode !== 0 && exitCode !== EXIT_CODE_LEAKS) {
    throw new Error(`Gitleaks failed with exit code ${exitCode}; see the log above.`);
  }
  return exitCode === EXIT_CODE_LEAKS;
}
