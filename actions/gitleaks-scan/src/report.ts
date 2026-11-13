import { relative, resolve } from 'node:path';

import { error, summary } from '@actions/core';

import { SHORT_SHA_LENGTH } from './gitleaks-scan-constants.js';
import type { Finding } from './gitleaks-scan.types.js';

/**
 * The parts of a SARIF report of Gitleaks that are read.
 */
interface SarifReport {
  runs?: {
    results?: {
      ruleId?: string;
      locations?: {
        physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } };
      }[];
      partialFingerprints?: { commitSha?: string };
    }[];
  }[];
}

/**
 * Reads the findings from a SARIF report of Gitleaks.
 *
 * Only rule, location, and commit are read; author data and the (redacted)
 * secret are left out.
 *
 * @param content - The SARIF report.
 * @returns The findings.
 * @throws {Error} if the report is not valid JSON.
 */
export function parseSarifReport(content: string): Finding[] {
  const report = JSON.parse(content) as SarifReport;
  return (report.runs ?? []).flatMap(run =>
    (run.results ?? []).map(result => {
      const location = result.locations?.[0]?.physicalLocation;
      return {
        rule: result.ruleId ?? 'unknown',
        file: location?.artifactLocation?.uri ?? '',
        line: location?.region?.startLine ?? 1,
        commit: result.partialFingerprints?.commitSha ?? '',
      };
    }),
  );
}

/**
 * Reports every finding as error annotation at its file and line, so that it
 * shows in the pull request diff.
 *
 * @param findings - The findings.
 * @param workingDirectory - The scanned repository.
 * @param workspace - The workspace annotation paths are relative to.
 */
export function annotateFindings(findings: Finding[], workingDirectory: string, workspace: string): void {
  for (const { rule, file, line, commit } of findings) {
    error(`Potential secret (rule "${rule}") added in commit ${commit}.`, {
      title: 'Gitleaks',
      file: relative(workspace, resolve(workingDirectory, file)),
      startLine: line,
    });
  }
}

/**
 * Escapes text for the HTML table of the job summary; rule IDs and file names
 * come from the scanned repository.
 *
 * @param text - The text.
 * @returns The escaped text.
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Writes the findings to the job summary.
 *
 * @param findings - The findings.
 * @param version - The Gitleaks version.
 */
export async function writeSummary(findings: Finding[], version: string): Promise<void> {
  summary.addHeading('🔐 Gitleaks Scan', 2);
  if (findings.length === 0) {
    summary.addRaw(`No potential secrets found (Gitleaks ${version}).`, true);
  } else {
    summary.addRaw(`${findings.length} potential secret(s) found (Gitleaks ${version}):`, true).addTable([
      [
        { data: 'Rule', header: true },
        { data: 'File', header: true },
        { data: 'Line', header: true },
        { data: 'Commit', header: true },
      ],
      ...findings.map(({ rule, file, line, commit }) => [
        escapeHtml(rule),
        escapeHtml(file),
        String(line),
        escapeHtml(commit.slice(0, SHORT_SHA_LENGTH)),
      ]),
    ]);
  }
  await summary.write();
}
