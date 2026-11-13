import {
  ALLOWED_ACTIONS_OPTIONS,
  AUTOLINK_KEYS,
  BYPASS_ACTOR_KEYS,
  BYPASS_ACTOR_TYPES,
  BYPASS_MODES,
  CONFIG_SECTIONS,
  ENVIRONMENT_KEYS,
  LABEL_COLOR_PATTERN,
  LABEL_KEYS,
  MAX_ENVIRONMENT_REVIEWERS,
  MAX_TOPICS,
  MAX_WAIT_TIMER_MINUTES,
  PRUNE_AREAS,
  REPOSITORY_SETTING_TYPES,
  RULESET_ENFORCEMENT_OPTIONS,
  RULESET_KEYS,
  RULESET_TARGET_OPTIONS,
  SECURITY_SETTINGS,
  TOPIC_PATTERN,
  WORKFLOW_PERMISSIONS_OPTIONS,
} from './apply-repository-settings-constants.js';
import type {
  ActionsSettings,
  Autolink,
  CustomPropertyValue,
  Environment,
  Label,
  PruneSettings,
  Ruleset,
  SecuritySettings,
  SettingsConfig,
} from './apply-repository-settings.types.js';
import { parseYaml } from './parse-yaml.js';

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
 * Ensures that the values of a key are unique.
 *
 * @param items - The items.
 * @param path - The path for error messages.
 * @param key - The key.
 * @param normalize - Normalizes a value before comparing, for example to lowercase.
 * @throws {Error} if two items have the same value.
 */
function assertUnique(
  items: Record<string, unknown>[],
  path: string,
  key: string,
  normalize: (value: string) => string = value => value,
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = normalize(String(item[key]));
    if (seen.has(value)) {
      throw new Error(`Invalid configuration: two entries of "${path}" have the ${key} "${String(item[key])}".`);
    }
    seen.add(value);
  }
}

/**
 * Validates the section `labels`. Colors are normalized to six lowercase hex
 * digits without `#`.
 *
 * @param value - The section.
 * @returns The labels.
 */
function parseLabels(value: unknown): Label[] {
  const labels = assertObjectArray(value, 'labels', LABEL_KEYS).map((label, index) => {
    const path = `labels[${index}]`;
    assertValue(label.name, `${path}.name`, 'string');
    if (typeof label.color !== 'string' || !LABEL_COLOR_PATTERN.test(label.color)) {
      throw new Error(`Invalid configuration: "${path}.color" must be six hex digits, for example "d73a4a".`);
    }
    for (const key of ['description', 'old_name'] as const) {
      if (label[key] !== undefined) {
        assertValue(label[key], `${path}.${key}`, 'string');
      }
    }
    return { ...label, color: label.color.replace('#', '').toLowerCase() } as Label;
  });
  assertUnique(labels as unknown as Record<string, unknown>[], 'labels', 'name', name => name.toLowerCase());
  return labels;
}

/**
 * Validates the required reviewers of an environment.
 *
 * @param value - The reviewers.
 * @param path - The path for error messages.
 * @throws {Error} if a reviewer is invalid or there are too many.
 */
function assertReviewers(value: unknown, path: string): void {
  const reviewers = assertObjectArray(value, path, ['type', 'id']);
  if (reviewers.length > MAX_ENVIRONMENT_REVIEWERS) {
    throw new Error(`Invalid configuration: "${path}" must have at most ${MAX_ENVIRONMENT_REVIEWERS} entries.`);
  }
  for (const [index, reviewer] of reviewers.entries()) {
    assertValue(reviewer.type, `${path}[${index}].type`, ['User', 'Team']);
    if (!Number.isSafeInteger(reviewer.id)) {
      throw new TypeError(`Invalid configuration: "${path}[${index}].id" must be a number.`);
    }
  }
}

/**
 * Validates the deployment branch policy of an environment; `null` allows all
 * branches.
 *
 * @param value - The policy.
 * @param path - The path for error messages.
 * @throws {Error} if the policy is invalid.
 */
function assertBranchPolicy(value: unknown, path: string): void {
  if (value === null) {
    return;
  }
  const keys = ['protected_branches', 'custom_branch_policies'];
  const policy = assertObject(value, path, keys);
  for (const key of keys) {
    assertValue(policy[key], `${path}.${key}`, 'boolean');
  }
  if (policy.protected_branches === policy.custom_branch_policies) {
    throw new Error(
      `Invalid configuration: exactly one of "protected_branches" and "custom_branch_policies" in "${path}" must be true.`,
    );
  }
}

/**
 * Validates the deployment settings of an environment.
 *
 * @param environment - The environment.
 * @param path - The path for error messages.
 * @throws {Error} if the reviewers or the deployment policies are invalid.
 */
function assertDeploymentSettings(environment: Record<string, unknown>, path: string): void {
  if (environment.reviewers !== undefined) {
    assertReviewers(environment.reviewers, `${path}.reviewers`);
  }
  const policy = environment.deployment_branch_policy;
  if (policy !== undefined) {
    assertBranchPolicy(policy, `${path}.deployment_branch_policy`);
  }
  if (environment.deployment_policies === undefined) {
    return;
  }
  if (!(isObject(policy) && policy.custom_branch_policies === true)) {
    throw new Error(
      `Invalid configuration: "${path}.deployment_policies" needs "deployment_branch_policy.custom_branch_policies: true".`,
    );
  }
  const policies = assertObjectArray(environment.deployment_policies, `${path}.deployment_policies`, ['name', 'type']);
  for (const [index, item] of policies.entries()) {
    assertValue(item.name, `${path}.deployment_policies[${index}].name`, 'string');
    assertValue(item.type, `${path}.deployment_policies[${index}].type`, ['branch', 'tag']);
  }
}

/**
 * Validates the section `environments`. Secrets and variables are not part of
 * the configuration.
 *
 * @param value - The section.
 * @returns The environments.
 */
function parseEnvironments(value: unknown): Environment[] {
  const environments = assertObjectArray(value, 'environments', ENVIRONMENT_KEYS);
  for (const [index, environment] of environments.entries()) {
    const path = `environments[${index}]`;
    assertValue(environment.name, `${path}.name`, 'string');
    const timer = environment.wait_timer;
    if (
      timer !== undefined &&
      (!Number.isSafeInteger(timer) || (timer as number) < 0 || (timer as number) > MAX_WAIT_TIMER_MINUTES)
    ) {
      throw new Error(
        `Invalid configuration: "${path}.wait_timer" must be minutes from 0 to ${MAX_WAIT_TIMER_MINUTES}.`,
      );
    }
    if (environment.prevent_self_review !== undefined) {
      assertValue(environment.prevent_self_review, `${path}.prevent_self_review`, 'boolean');
    }
    assertDeploymentSettings(environment, path);
  }
  assertUnique(environments, 'environments', 'name', name => name.toLowerCase());
  return environments as unknown as Environment[];
}

/**
 * Validates the section `autolinks`.
 *
 * @param value - The section.
 * @returns The autolinks.
 */
function parseAutolinks(value: unknown): Autolink[] {
  const autolinks = assertObjectArray(value, 'autolinks', AUTOLINK_KEYS);
  for (const [index, autolink] of autolinks.entries()) {
    const path = `autolinks[${index}]`;
    assertValue(autolink.key_prefix, `${path}.key_prefix`, 'string');
    if (typeof autolink.url_template !== 'string' || !autolink.url_template.includes('<num>')) {
      throw new Error(`Invalid configuration: "${path}.url_template" must be a URL that contains "<num>".`);
    }
    if (autolink.is_alphanumeric !== undefined) {
      assertValue(autolink.is_alphanumeric, `${path}.is_alphanumeric`, 'boolean');
    }
  }
  assertUnique(autolinks, 'autolinks', 'key_prefix', prefix => prefix.toLowerCase());
  return autolinks as unknown as Autolink[];
}

/**
 * Validates the section `custom_properties`: values of properties that the
 * organization defines.
 *
 * @param value - The section.
 * @returns The property values.
 */
function parseCustomProperties(value: unknown): Record<string, CustomPropertyValue> {
  if (!isObject(value)) {
    throw new Error('Invalid configuration: "custom_properties" must be an object.');
  }
  for (const [name, property] of Object.entries(value)) {
    const valid =
      property === null ||
      typeof property === 'string' ||
      (Array.isArray(property) && property.every(item => typeof item === 'string'));
    if (!valid) {
      throw new Error(
        `Invalid configuration: "custom_properties.${name}" must be a string, an array of strings, or null.`,
      );
    }
  }
  return value as Record<string, CustomPropertyValue>;
}

/**
 * Validates the section `immutable_releases`.
 *
 * @param value - The section.
 * @returns Whether releases are immutable.
 */
function parseImmutableReleases(value: unknown): boolean {
  assertValue(value, 'immutable_releases', 'boolean');
  return value as boolean;
}

/**
 * Validates the section `prune`.
 *
 * @param value - The section.
 * @returns The areas to prune.
 */
function parsePrune(value: unknown): PruneSettings {
  const section = assertObject(value, 'prune', PRUNE_AREAS);
  for (const [key, setting] of Object.entries(section)) {
    assertValue(setting, `prune.${key}`, 'boolean');
  }
  return section;
}

/**
 * Parses and validates a settings configuration.
 *
 * @param text - The contents of the configuration file, YAML or JSON.
 * @returns The validated configuration.
 * @throws {Error} if the file is invalid, a key is unknown, or a value has the wrong type.
 */
export function parseConfig(text: string): SettingsConfig {
  const root = assertObject(parseYaml(text) ?? {}, '(root)', CONFIG_SECTIONS);
  const config: SettingsConfig = {};
  const parsers: { [K in keyof SettingsConfig]-?: (value: unknown) => SettingsConfig[K] } = {
    repository: parseRepository,
    topics: parseTopics,
    security: parseSecurity,
    actions: parseActions,
    rulesets: parseRulesets,
    labels: parseLabels,
    environments: parseEnvironments,
    autolinks: parseAutolinks,
    custom_properties: parseCustomProperties,
    immutable_releases: parseImmutableReleases,
    prune: parsePrune,
  };
  for (const [section, parse] of Object.entries(parsers)) {
    if (root[section] !== undefined) {
      (config as Record<string, unknown>)[section] = parse(root[section]);
    }
  }
  for (const area of PRUNE_AREAS) {
    if (config.prune?.[area] && config[area] === undefined) {
      throw new Error(
        `Invalid configuration: "prune.${area}" needs the section "${area}"; an empty list deletes all ${area}.`,
      );
    }
  }
  return config;
}
