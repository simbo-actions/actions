import { access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arch, cwd, env, platform } from 'node:process';

import { info, setOutput, warning } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { isShallowRepository } from './git.js';
import { GITLEAKS_VERSION } from './gitleaks-scan-constants.js';
import { installGitleaks } from './install-gitleaks.js';
import { annotateFindings, parseSarifReport, potentialSecrets, writeSummary } from './report.js';
import { runGitleaks } from './run-gitleaks.js';
import { readWorkflowEvent, resolveScanTarget } from './scan-target.js';

/**
 * Checks that a file given as input exists.
 *
 * @param input - The input name, for the message.
 * @param workingDirectory - The directory the path is relative to.
 * @param path - The path, or an empty string if the input is not set.
 * @throws {Error} if the input is set and the file does not exist.
 */
async function assertFileInput(input: string, workingDirectory: string, path: string): Promise<void> {
  if (!path) {
    return;
  }
  try {
    await access(join(workingDirectory, path));
  } catch {
    throw new Error(`Invalid input "${input}": "${path}" does not exist in "${workingDirectory}".`);
  }
}

/**
 * Main entry point for the gitleaks-scan action.
 *
 * Determines what to scan, installs the pinned Gitleaks binary, runs the
 * scan, and reports every finding as annotation and in the job summary.
 *
 * @throws {Error} if Gitleaks finds potential secrets (unless "fail-on-findings" is false), cannot be installed, or fails.
 */
export async function main(): Promise<void> {
  const inputs = parseActionInputs();
  await assertFileInput('config', inputs.workingDirectory, inputs.config);
  await assertFileInput('baseline-path', inputs.workingDirectory, inputs.baselinePath);

  const target = await resolveScanTarget(inputs, await readWorkflowEvent(env));
  if (target.logOpts === '' && target.mode === 'git' && (await isShallowRepository(inputs.workingDirectory))) {
    warning('The repository is a shallow clone; only its commits are scanned. Check it out with "fetch-depth: 0".');
  }
  setOutput('scanned', target.description);

  const binary = await installGitleaks(platform, arch);
  info(`Scanning ${target.description} with Gitleaks ${GITLEAKS_VERSION}.`);
  const reportPath = join(env.RUNNER_TEMP ?? tmpdir(), 'gitleaks.sarif');
  const leaks = await runGitleaks(binary, target, { ...inputs, reportPath });

  const findings = parseSarifReport(await readFile(reportPath, 'utf8'));
  const failing = inputs.failOnFindings;
  annotateFindings(findings, {
    workingDirectory: inputs.workingDirectory,
    workspace: env.GITHUB_WORKSPACE ?? cwd(),
    failing,
  });
  await writeSummary(findings, { scanned: target.description, version: GITLEAKS_VERSION, failing });
  setOutput('findings', String(findings.length));
  setOutput('sarif-file', reportPath);

  if (!leaks && findings.length === 0) {
    info('✅ No potential secrets found.');
  } else if (failing) {
    throw new Error(
      `Gitleaks found ${potentialSecrets(findings.length)}. Revoke real secrets first, then remove them; add false positives to .gitleaksignore.`,
    );
  } else {
    warning(`Gitleaks found ${potentialSecrets(findings.length)}; not failing, because "fail-on-findings" is false.`);
  }
}
