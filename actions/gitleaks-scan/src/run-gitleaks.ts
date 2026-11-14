import { exec } from '@actions/exec';

import { EXIT_CODE_LEAKS } from './gitleaks-scan-constants.js';
import type { ScanTarget } from './gitleaks-scan.types.js';

/**
 * Runs Gitleaks on a repository, with secrets redacted.
 *
 * @param binary - The path of the Gitleaks binary.
 * @param target - What to scan.
 * @param params - The scan parameters.
 * @param params.workingDirectory - The repository to scan.
 * @param params.config - A configuration file, or an empty string for the default.
 * @param params.baselinePath - A baseline report, or an empty string for none.
 * @param params.reportPath - Where to write the SARIF report.
 * @returns Whether Gitleaks found leaks.
 * @throws {Error} if Gitleaks fails.
 */
export async function runGitleaks(
  binary: string,
  target: ScanTarget,
  params: { workingDirectory: string; config: string; baselinePath: string; reportPath: string },
): Promise<boolean> {
  const args = [
    target.mode,
    '--redact',
    '--no-banner',
    '--report-format',
    'sarif',
    '--report-path',
    params.reportPath,
    '--exit-code',
    String(EXIT_CODE_LEAKS),
    ...(params.config ? ['--config', params.config] : []),
    ...(params.baselinePath ? ['--baseline-path', params.baselinePath] : []),
    // With "=", a value that starts with "-" is not read as a flag.
    ...(target.logOpts ? [`--log-opts=${target.logOpts}`] : []),
    '.',
  ];
  const exitCode = await exec(binary, args, { cwd: params.workingDirectory, ignoreReturnCode: true });
  if (exitCode !== 0 && exitCode !== EXIT_CODE_LEAKS) {
    throw new Error(`Gitleaks failed with exit code ${exitCode}; see the log above.`);
  }
  return exitCode === EXIT_CODE_LEAKS;
}
