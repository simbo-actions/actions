/**
 * Repository settings that can be configured, with their value type.
 */
export const REPOSITORY_SETTING_TYPES: Readonly<Record<string, 'string' | 'boolean'>> = {
  description: 'string',
  homepage: 'string',
  has_issues: 'boolean',
  has_projects: 'boolean',
  has_wiki: 'boolean',
  has_discussions: 'boolean',
  allow_squash_merge: 'boolean',
  allow_merge_commit: 'boolean',
  allow_rebase_merge: 'boolean',
  allow_auto_merge: 'boolean',
  allow_update_branch: 'boolean',
  delete_branch_on_merge: 'boolean',
  web_commit_signoff_required: 'boolean',
  squash_merge_commit_title: 'string',
  squash_merge_commit_message: 'string',
  merge_commit_title: 'string',
  merge_commit_message: 'string',
};

/**
 * Security settings that can be configured.
 */
export const SECURITY_SETTINGS = [
  'secret_scanning',
  'secret_scanning_push_protection',
  'dependabot_alerts',
  'dependabot_security_updates',
  'private_vulnerability_reporting',
] as const;

/**
 * Allowed values of the Actions setting `allowed_actions`.
 */
export const ALLOWED_ACTIONS_OPTIONS = ['all', 'local_only', 'selected'] as const;

/**
 * Allowed values of the Actions setting `default_workflow_permissions`.
 */
export const WORKFLOW_PERMISSIONS_OPTIONS = ['read', 'write'] as const;

/**
 * Sections of the configuration file.
 */
export const CONFIG_SECTIONS = [
  '$schema',
  'repository',
  'security',
  'actions',
  'rulesets',
  'immutable_releases',
] as const;

/**
 * HTTP status of the GitHub API for a missing resource.
 */
export const HTTP_STATUS_NOT_FOUND = 404;
