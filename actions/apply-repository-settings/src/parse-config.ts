import {
  ALLOWED_ACTIONS_OPTIONS,
  CONFIG_SECTIONS,
  REPOSITORY_SETTING_TYPES,
  SECURITY_SETTINGS,
  WORKFLOW_PERMISSIONS_OPTIONS,
} from './apply-repository-settings-constants.js';
import type { ActionsSettings, Ruleset, SecuritySettings, SettingsConfig } from './apply-repository-settings.types.js';

/**
 * Checks whether a value is a plain object.
 *
 * @param value - The value.
 * @returns `true` for an object that is not an array or `null`.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ensures that a value is an object with only known keys.
 *
 * @param value - The value.
 * @param path - The path in the configuration, for error messages.
 * @param keys - The known keys.
 * @returns The object.
 * @throws {Error} if the value is not an object or has unknown keys.
 */
function assertObject(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Invalid configuration: "${path}" must be an object.`);
  }
  const unknown = Object.keys(value).filter(key => !keys.includes(key));
  if (unknown.length > 0) {
    throw new Error(`Invalid configuration: unknown key(s) in "${path}": ${unknown.join(', ')}.`);
  }
  return value;
}

/**
 * Ensures that a value has the expected type or is one of the allowed values.
 *
 * @param value - The value.
 * @param path - The path in the configuration, for error messages.
 * @param expected - The expected type, or the allowed values.
 * @throws {Error} if the value does not match.
 */
function assertValue(value: unknown, path: string, expected: 'string' | 'boolean' | readonly string[]): void {
  const valid = typeof expected === 'string' ? typeof value === expected : expected.includes(value as string);
  if (valid) {
    return;
  }
  const description = typeof expected === 'string' ? `a ${expected}` : `one of: ${expected.join(', ')}`;
  throw new Error(`Invalid configuration: "${path}" must be ${description}.`);
}

/**
 * Validates the section `repository`.
 *
 * @param value - The section.
 * @returns The repository settings.
 */
function parseRepository(value: unknown): Record<string, string | boolean> {
  const section = assertObject(value, 'repository', Object.keys(REPOSITORY_SETTING_TYPES));
  for (const [key, setting] of Object.entries(section)) {
    assertValue(setting, `repository.${key}`, REPOSITORY_SETTING_TYPES[key]);
  }
  return section as Record<string, string | boolean>;
}

/**
 * Validates the section `security`.
 *
 * @param value - The section.
 * @returns The security settings.
 */
function parseSecurity(value: unknown): SecuritySettings {
  const section = assertObject(value, 'security', SECURITY_SETTINGS);
  for (const [key, setting] of Object.entries(section)) {
    assertValue(setting, `security.${key}`, 'boolean');
  }
  return section;
}

/**
 * Validates the section `actions`.
 *
 * @param value - The section.
 * @returns The Actions settings.
 */
function parseActions(value: unknown): ActionsSettings {
  const types: Record<string, 'boolean' | readonly string[]> = {
    enabled: 'boolean',
    allowed_actions: ALLOWED_ACTIONS_OPTIONS,
    sha_pinning_required: 'boolean',
    default_workflow_permissions: WORKFLOW_PERMISSIONS_OPTIONS,
    can_approve_pull_request_reviews: 'boolean',
  };
  const section = assertObject(value, 'actions', Object.keys(types));
  for (const [key, setting] of Object.entries(section)) {
    assertValue(setting, `actions.${key}`, types[key]);
  }
  return section;
}

/**
 * Validates the section `rulesets`. The rulesets are passed to the API as they
 * are; only the fields needed to match them are checked.
 *
 * @param value - The section.
 * @returns The rulesets.
 */
function parseRulesets(value: unknown): Ruleset[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid configuration: "rulesets" must be an array.');
  }
  const names = new Set<string>();
  return value.map((ruleset: unknown, index) => {
    const path = `rulesets[${index}]`;
    if (!isObject(ruleset)) {
      throw new Error(`Invalid configuration: "${path}" must be an object.`);
    }
    assertValue(ruleset.name, `${path}.name`, 'string');
    assertValue(ruleset.enforcement, `${path}.enforcement`, ['active', 'evaluate', 'disabled']);
    const name = ruleset.name as string;
    if (names.has(name)) {
      throw new Error(`Invalid configuration: two rulesets are named "${name}".`);
    }
    names.add(name);
    return ruleset as unknown as Ruleset;
  });
}

/**
 * Parses and validates a settings configuration.
 *
 * @param json - The contents of the configuration file.
 * @returns The validated configuration.
 * @throws {Error} if the JSON is invalid, a key is unknown, or a value has the wrong type.
 */
export function parseConfig(json: string): SettingsConfig {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid configuration: not valid JSON.`, { cause: error });
  }
  const root = assertObject(data, '(root)', CONFIG_SECTIONS);
  const config: SettingsConfig = {};

  if (root.repository !== undefined) {
    config.repository = parseRepository(root.repository);
  }
  if (root.security !== undefined) {
    config.security = parseSecurity(root.security);
  }
  if (root.actions !== undefined) {
    config.actions = parseActions(root.actions);
  }
  if (root.rulesets !== undefined) {
    config.rulesets = parseRulesets(root.rulesets);
  }
  if (root.immutable_releases !== undefined) {
    assertValue(root.immutable_releases, 'immutable_releases', 'boolean');
    config.immutable_releases = root.immutable_releases as boolean;
  }

  return config;
}
