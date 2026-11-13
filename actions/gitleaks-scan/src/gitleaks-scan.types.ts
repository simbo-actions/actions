import type { SCOPES } from './gitleaks-scan-constants.js';

/**
 * What to scan: the changes of the event, the whole history, or the files of
 * the working tree.
 */
export type Scope = (typeof SCOPES)[number];

/**
 * Parsed inputs for the gitleaks-scan action.
 */
export interface ParsedActionInputs {
  workingDirectory: string;
  scope: Scope;
  logOpts: string;
  config: string;
  baselinePath: string;
  failOnFindings: boolean;
}

/**
 * The parts of a workflow event that define the changes to scan.
 */
export interface WorkflowEvent {
  /**
   * The event name, for example `push` or `pull_request`.
   */
  name: string;

  /**
   * The event payload.
   */
  payload: Record<string, unknown>;
}

/**
 * The commits an event introduces.
 */
export interface EventRange {
  /**
   * The commit before the changes; all zeros for a new branch or tag.
   */
  base: string;

  /**
   * The last commit of the changes.
   */
  head: string;

  /**
   * The pushed ref, for example `refs/heads/main`; only for push events.
   */
  ref?: string;
}

/**
 * What Gitleaks scans.
 */
export interface ScanTarget {
  /**
   * `git` scans commits, `dir` the files of the working tree.
   */
  mode: 'git' | 'dir';

  /**
   * Options for `git log`, or an empty string for the whole history.
   */
  logOpts: string;

  /**
   * A short description, for example `changes abc1234..def5678 (3 commits)`.
   */
  description: string;
}

/**
 * A potential secret found by Gitleaks. The secret itself is never part of it.
 */
export interface Finding {
  /**
   * The ID of the rule that matched, for example `github-pat`.
   */
  rule: string;

  /**
   * The file path, relative to the scanned repository.
   */
  file: string;

  /**
   * The line of the finding.
   */
  line: number;

  /**
   * The commit that added the finding; empty when files are scanned.
   */
  commit: string;
}
