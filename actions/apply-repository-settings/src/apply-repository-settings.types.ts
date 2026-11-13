/**
 * A rule of a ruleset.
 */
export interface Rule {
  type: string;
  parameters?: Record<string, unknown>;
}

/**
 * A bypass actor of a ruleset.
 */
export interface BypassActor {
  actor_id: number | null;
  actor_type: string;
  bypass_mode?: string;
}

/**
 * A ruleset as defined in the configuration and sent to the GitHub API.
 */
export interface Ruleset {
  name: string;
  target?: string;
  enforcement: string;
  conditions?: Record<string, unknown>;
  bypass_actors?: BypassActor[];
  rules?: Rule[];
}

/**
 * Security settings.
 */
export interface SecuritySettings {
  secret_scanning?: boolean;
  secret_scanning_push_protection?: boolean;
  dependabot_alerts?: boolean;
  dependabot_security_updates?: boolean;
  private_vulnerability_reporting?: boolean;
}

/**
 * Actions settings.
 */
export interface ActionsSettings {
  enabled?: boolean;
  allowed_actions?: 'all' | 'local_only' | 'selected';
  sha_pinning_required?: boolean;
  default_workflow_permissions?: 'read' | 'write';
  can_approve_pull_request_reviews?: boolean;
}

/**
 * A label of issues and pull requests.
 */
export interface Label {
  name: string;

  /**
   * The color as six hex digits, without `#`.
   */
  color: string;

  description?: string;

  /**
   * The current name of a label to rename.
   */
  old_name?: string;
}

/**
 * A required reviewer of a deployment environment.
 */
export interface EnvironmentReviewer {
  type: 'User' | 'Team';
  id: number;
}

/**
 * A branch or tag pattern that may deploy to an environment.
 */
export interface DeploymentPolicy {
  name: string;
  type: 'branch' | 'tag';
}

/**
 * A deployment environment; secrets and variables are not managed.
 */
export interface Environment {
  name: string;
  wait_timer?: number;
  prevent_self_review?: boolean;
  reviewers?: EnvironmentReviewer[];
  deployment_branch_policy?: { protected_branches: boolean; custom_branch_policies: boolean } | null;

  /**
   * The branches and tags that may deploy, with `custom_branch_policies`.
   */
  deployment_policies?: DeploymentPolicy[];
}

/**
 * An autolink reference, for example `TICKET-123` to an issue tracker.
 */
export interface Autolink {
  key_prefix: string;
  url_template: string;
  is_alphanumeric?: boolean;
}

/**
 * The value of a custom property; `null` removes it.
 */
export type CustomPropertyValue = string | string[] | null;

/**
 * The areas whose unconfigured entries are deleted.
 */
export interface PruneSettings {
  labels?: boolean;
  rulesets?: boolean;
  environments?: boolean;
  autolinks?: boolean;
}

/**
 * The settings configuration. Every section and every key is optional;
 * only what is configured is applied.
 */
export interface SettingsConfig {
  repository?: Record<string, string | boolean>;
  topics?: string[];
  security?: SecuritySettings;
  actions?: ActionsSettings;
  rulesets?: Ruleset[];
  labels?: Label[];
  environments?: Environment[];
  autolinks?: Autolink[];
  custom_properties?: Record<string, CustomPropertyValue>;
  immutable_releases?: boolean;
  prune?: PruneSettings;
}

/**
 * Parsed inputs for the apply-repository-settings action.
 */
export interface ParsedActionInputs {
  token: string;
  owner: string;
  repo: string;
  config: SettingsConfig;
  dryRun: boolean;
}

/**
 * A change that was applied, or would be applied in a dry run.
 */
export interface SettingChange {
  /**
   * The setting, for example `repository.has_issues` or `ruleset "Main Branch"`.
   */
  setting: string;

  /**
   * What changes, for example `true → false`, `create`, or `update`.
   */
  change: string;
}
