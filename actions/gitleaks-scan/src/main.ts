import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arch, cwd, env, platform } from 'node:process';

import { info, setOutput, warning } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { GITLEAKS_VERSION } from './gitleaks-scan-constants.js';
import { installGitleaks } from './install-gitleaks.js';
import { annotateFindings, parseSarifReport, writeSummary } from './report.js';
import { isShallowRepository, runGitleaks } from './run-gitleaks.js';

/**
 * Main entry point for the gitleaks-scan action.
 *
 * Installs the pinned Gitleaks binary, scans the Git history, and reports
 * every finding as annotation and in the job summary.
 *
 * @throws {Error} if Gitleaks finds potential secrets, cannot be installed, or fails.
 */
export async function main(): Promise<void> {
  const inputs = parseActionInputs();
  const binary = await installGitleaks(platform, arch);
  info(`Installed Gitleaks ${GITLEAKS_VERSION}.`);

  if (await isShallowRepository(inputs.workingDirectory)) {
    warning('The repository is a shallow clone; only its commits are scanned. Check it out with "fetch-depth: 0".');
  }

  const reportPath = join(env.RUNNER_TEMP ?? tmpdir(), 'gitleaks.sarif');
  const leaks = await runGitleaks(binary, { ...inputs, reportPath });
  const findings = parseSarifReport(await readFile(reportPath, 'utf8'));

  annotateFindings(findings, inputs.workingDirectory, env.GITHUB_WORKSPACE ?? cwd());
  await writeSummary(findings, GITLEAKS_VERSION);
  setOutput('findings', String(findings.length));
  setOutput('sarif-file', reportPath);

  if (leaks || findings.length > 0) {
    throw new Error(
      `Gitleaks found ${findings.length} potential secret(s). Revoke real secrets first, then remove them; add false positives to .gitleaksignore.`,
    );
  }
  info('No potential secrets found.');
}
