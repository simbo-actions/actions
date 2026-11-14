import { relative, resolve } from 'node:path';

import { error, summary, warning } from '@actions/core';

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
 * Formats a number of findings.
 *
 * @param count - The number.
 * @returns For example `1 potential secret` or `3 potential secrets`.
 */
export function potentialSecrets(count: number): string {
  return `${count} potential secret${count === 1 ? '' : 's'}`;
}

/**
 * Reports every finding as annotation at its file and line, so that it shows
 * in the pull request diff.
 *
 * @param findings - The findings.
 * @param params - The report parameters.
 * @param params.workingDirectory - The scanned repository.
 * @param params.workspace - The workspace annotation paths are relative to.
 * @param params.failing - Whether the findings fail the action: errors instead of warnings.
 */
export function annotateFindings(
  findings: Finding[],
  params: { workingDirectory: string; workspace: string; failing: boolean },
): void {
  const annotate = params.failing ? error : warning;
  for (const { rule, file, line, commit } of findings) {
    annotate(`Potential secret (rule "${rule}") ${commit ? `added in commit ${commit}` : 'in the working tree'}.`, {
      title: 'Gitleaks',
      file: relative(params.workspace, resolve(params.workingDirectory, file)),
      startLine: line,
    });
  }
}

/**
 * Escapes text for the HTML of the job summary; rule IDs and file names come
 * from the scanned repository.
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
 * Writes the result to the job summary: a status line, the findings, and
 * what was scanned.
 *
 * @param findings - The findings.
 * @param params - The summary parameters.
 * @param params.scanned - What was scanned.
 * @param params.version - The Gitleaks version.
 * @param params.failing - Whether the findings fail the action.
 */
export async function writeSummary(
  findings: Finding[],
  params: { scanned: string; version: string; failing: boolean },
): Promise<void> {
  summary.addHeading('🔐 Gitleaks Scan', 2);
  if (findings.length === 0) {
    summary.addRaw('✅ No potential secrets found.', true);
  } else {
    summary
      .addRaw(`${params.failing ? '❌' : '⚠️'} <strong>${potentialSecrets(findings.length)} found.</strong>`, true)
      .addTable([
        [
          { data: 'Rule', header: true },
          { data: 'File', header: true },
          { data: 'Line', header: true },
          { data: 'Commit', header: true },
        ],
        ...findings.map(({ rule, file, line, commit }) => [
          `<code>${escapeHtml(rule)}</code>`,
          escapeHtml(file),
          String(line),
          commit ? `<code>${escapeHtml(commit.slice(0, SHORT_SHA_LENGTH))}</code>` : '–',
        ]),
      ])
      .addRaw(
        'Revoke real secrets first, then remove them; add false positives to <code>.gitleaksignore</code>.',
        true,
      );
  }
  summary.addRaw(`<sub>Scanned: ${escapeHtml(params.scanned)} · Gitleaks ${params.version}</sub>`, true);
  await summary.write();
}
