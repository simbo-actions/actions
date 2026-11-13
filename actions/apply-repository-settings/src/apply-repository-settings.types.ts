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
 * The settings configuration. Every section and every key is optional;
 * only what is configured is applied.
 */
export interface SettingsConfig {
  repository?: Record<string, string | boolean>;
  topics?: string[];
  security?: SecuritySettings;
  actions?: ActionsSettings;
  rulesets?: Ruleset[];
  immutable_releases?: boolean;
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
