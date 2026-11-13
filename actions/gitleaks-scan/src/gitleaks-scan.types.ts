/**
 * Parsed inputs for the gitleaks-scan action.
 */
export interface ParsedActionInputs {
  workingDirectory: string;
  config: string;
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
   * The commit that added the finding.
   */
  commit: string;
}
