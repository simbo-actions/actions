import type { DETECT_CHANGES_OPTIONS, IF_NO_CHANGES_OPTIONS } from './signed-commit-constants.js';

/**
 * An option for detecting file changes.
 */
export type DetectChangesOption = (typeof DETECT_CHANGES_OPTIONS)[number];

/**
 * An option for handling a commit without changes.
 */
export type IfNoChangesOption = (typeof IF_NO_CHANGES_OPTIONS)[number];

/**
 * A file addition for a commit, with base64-encoded contents.
 */
export interface FileAddition {
  path: string;
  contents: string;
}

/**
 * A file deletion for a commit.
 */
export type FileDeletion = Pick<FileAddition, 'path'>;

/**
 * The file changes of a commit.
 */
export interface FileChanges {
  additions: FileAddition[];
  deletions: FileDeletion[];
}

/**
 * A commit message split into headline and body.
 */
export interface CommitMessage {
  headline: string;
  body?: string;
}

/**
 * Parsed inputs for the signed-commit action.
 */
export interface ParsedActionInputs {
  token: string;
  message: CommitMessage;
  owner: string;
  repo: string;
  branch: string;
  workingDirectory: string;
  additionsList: string[];
  deletionsList: string[];
  detectChanges: DetectChangesOption;
  tags: string[];
  ifNoChanges: IfNoChangesOption;
  sync: boolean;
  expectedHeadOid: string;
  shouldCreateBranch: boolean;
  base: string;
  filePatterns: string[];
}

/**
 * Where the branch to commit to starts.
 */
export interface BranchHead {
  /**
   * The commit the branch points to, or will point to once created.
   */
  oid: string;

  /**
   * The branch or commit the missing branch is created from; `undefined` if
   * the branch exists.
   */
  createdFrom?: string;
}
