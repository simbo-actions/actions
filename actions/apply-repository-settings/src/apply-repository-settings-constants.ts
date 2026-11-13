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
  has_pull_requests: 'boolean',
  pull_request_creation_policy: 'string',
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
 * Valid repository topics: lowercase letters, digits, and hyphens, up to 50 characters.
 */
export const TOPIC_PATTERN = /^[\da-z][\da-z-]{0,49}$/;

/**
 * Maximum number of topics of a repository.
 */
export const MAX_TOPICS = 20;

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
  'topics',
  'security',
  'actions',
  'rulesets',
  'immutable_releases',
] as const;

/**
 * HTTP status of the GitHub API for a missing resource.
 */
export const HTTP_STATUS_NOT_FOUND = 404;

/**
 * The keys of a ruleset in the configuration. Other keys fail, so that no key
 * can change the API request itself (for example its URL or headers).
 */
export const RULESET_KEYS = ['name', 'target', 'enforcement', 'conditions', 'rules', 'bypass_actors'] as const;

/**
 * The enforcement options of a ruleset.
 */
export const RULESET_ENFORCEMENT_OPTIONS = ['active', 'evaluate', 'disabled'] as const;

/**
 * The targets of a repository ruleset.
 */
export const RULESET_TARGET_OPTIONS = ['branch', 'tag', 'push'] as const;

/**
 * The keys of a bypass actor.
 */
export const BYPASS_ACTOR_KEYS = ['actor_id', 'actor_type', 'bypass_mode'] as const;

/**
 * The types of bypass actors.
 */
export const BYPASS_ACTOR_TYPES = [
  'Integration',
  'OrganizationAdmin',
  'RepositoryRole',
  'Team',
  'DeployKey',
  'EnterpriseOwner',
] as const;

/**
 * The bypass modes of a bypass actor.
 */
export const BYPASS_MODES = ['always', 'pull_request', 'exempt'] as const;
