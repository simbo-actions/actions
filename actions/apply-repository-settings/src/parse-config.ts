import {
  ALLOWED_ACTIONS_OPTIONS,
  BYPASS_ACTOR_KEYS,
  BYPASS_ACTOR_TYPES,
  BYPASS_MODES,
  CONFIG_SECTIONS,
  MAX_TOPICS,
  REPOSITORY_SETTING_TYPES,
  RULESET_ENFORCEMENT_OPTIONS,
  RULESET_KEYS,
  RULESET_TARGET_OPTIONS,
  SECURITY_SETTINGS,
  TOPIC_PATTERN,
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
 * Validates the section `topics`.
 *
 * @param value - The section.
 * @returns The topics.
 * @throws {Error} if the topics are not an array of valid, unique topics.
 */
function parseTopics(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid configuration: "topics" must be an array.');
  }
  if (value.length > MAX_TOPICS) {
    throw new Error(`Invalid configuration: "topics" must have at most ${MAX_TOPICS} entries.`);
  }
  for (const [index, topic] of value.entries()) {
    if (typeof topic !== 'string' || !TOPIC_PATTERN.test(topic)) {
      throw new Error(
        `Invalid configuration: "topics[${index}]" must be lowercase letters, digits, and hyphens (at most 50).`,
      );
    }
  }
  const unique = new Set(value);
  if (unique.size !== value.length) {
    throw new Error('Invalid configuration: "topics" must not contain duplicates.');
  }
  return value as string[];
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
 * Validates an array of objects with allowed keys.
 *
 * @param value - The array.
 * @param path - The path for error messages.
 * @param keys - The allowed keys of every item.
 * @returns The items.
 * @throws {Error} if the value is not an array of such objects.
 */
function assertObjectArray(value: unknown, path: string, keys: readonly string[]): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Invalid configuration: "${path}" must be an array.`);
  }
  return value.map((item: unknown, index) => assertObject(item, `${path}[${index}]`, keys));
}

/**
 * Validates the conditions of a ruleset: only `ref_name` with string lists.
 *
 * @param value - The conditions.
 * @param path - The path for error messages.
 * @throws {Error} if the conditions are invalid.
 */
function assertRulesetConditions(value: unknown, path: string): void {
  const conditions = assertObject(value, path, ['ref_name']);
  if (conditions.ref_name === undefined) {
    return;
  }
  const refName = assertObject(conditions.ref_name, `${path}.ref_name`, ['include', 'exclude']);
  for (const key of ['include', 'exclude'] as const) {
    const list = refName[key];
    if (list !== undefined && (!Array.isArray(list) || list.some(item => typeof item !== 'string'))) {
      throw new Error(`Invalid configuration: "${path}.ref_name.${key}" must be an array of strings.`);
    }
  }
}

/**
 * Validates the rules of a ruleset; their parameters depend on the rule type.
 *
 * @param value - The rules.
 * @param path - The path for error messages.
 * @throws {Error} if a rule is invalid.
 */
function assertRules(value: unknown, path: string): void {
  for (const [index, rule] of assertObjectArray(value, path, ['type', 'parameters']).entries()) {
    assertValue(rule.type, `${path}[${index}].type`, 'string');
    if (rule.parameters !== undefined && !isObject(rule.parameters)) {
      throw new Error(`Invalid configuration: "${path}[${index}].parameters" must be an object.`);
    }
  }
}

/**
 * Validates the bypass actors of a ruleset.
 *
 * @param value - The bypass actors.
 * @param path - The path for error messages.
 * @throws {Error} if a bypass actor is invalid.
 */
function assertBypassActors(value: unknown, path: string): void {
  for (const [index, actor] of assertObjectArray(value, path, BYPASS_ACTOR_KEYS).entries()) {
    const actorPath = `${path}[${index}]`;
    if (actor.actor_id !== null && typeof actor.actor_id !== 'number') {
      throw new Error(`Invalid configuration: "${actorPath}.actor_id" must be a number or null.`);
    }
    assertValue(actor.actor_type, `${actorPath}.actor_type`, BYPASS_ACTOR_TYPES);
    if (actor.bypass_mode !== undefined) {
      assertValue(actor.bypass_mode, `${actorPath}.bypass_mode`, BYPASS_MODES);
    }
  }
}

/**
 * Validates the section `rulesets`. Every key is checked; the parameters of a
 * rule depend on its type and are passed to the API as they are.
 *
 * @param value - The section.
 * @returns The rulesets.
 */
function parseRulesets(value: unknown): Ruleset[] {
  const names = new Set<string>();
  return assertObjectArray(value, 'rulesets', RULESET_KEYS).map((ruleset, index) => {
    const path = `rulesets[${index}]`;
    assertValue(ruleset.name, `${path}.name`, 'string');
    assertValue(ruleset.enforcement, `${path}.enforcement`, RULESET_ENFORCEMENT_OPTIONS);
    if (ruleset.target !== undefined) {
      assertValue(ruleset.target, `${path}.target`, RULESET_TARGET_OPTIONS);
    }
    if (ruleset.conditions !== undefined) {
      assertRulesetConditions(ruleset.conditions, `${path}.conditions`);
    }
    if (ruleset.rules !== undefined) {
      assertRules(ruleset.rules, `${path}.rules`);
    }
    if (ruleset.bypass_actors !== undefined) {
      assertBypassActors(ruleset.bypass_actors, `${path}.bypass_actors`);
    }
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
  if (root.topics !== undefined) {
    config.topics = parseTopics(root.topics);
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
