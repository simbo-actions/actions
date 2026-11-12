import type { ActionsSettings, Ruleset, SecuritySettings, SettingsConfig } from './apply-repository-settings.types.js';
import { rulesetMatches } from './matches.js';
import type { SettingsClient } from './settings-client.js';

/**
 * Formats a change of a value.
 *
 * @param from - The current value.
 * @param to - The configured value.
 * @returns The change, for example `true → false`.
 */
function formatChange(from: unknown, to: unknown): string {
  return `${from === undefined ? 'unset' : JSON.stringify(from)} → ${JSON.stringify(to)}`;
}

/**
 * Applies the repository settings and the security features that are part of
 * the repository resource (secret scanning, push protection), in one request.
 *
 * @param client - The settings client.
 * @param repository - The configured repository settings.
 * @param security - The configured security settings.
 */
export async function applyRepositorySettings(
  client: SettingsClient,
  repository: Record<string, string | boolean>,
  security: SecuritySettings,
): Promise<void> {
  const current = await client.read<Record<string, unknown>>('GET /repos/{owner}/{repo}');
  const changed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(repository)) {
    if (current[key] === value) {
      continue;
    }

    changed[key] = value;
    client.record({ setting: `repository.${key}`, change: formatChange(current[key], value) });
  }

  const currentSecurity = (current.security_and_analysis ?? {}) as Record<string, { status?: string } | undefined>;
  const securityAndAnalysis: Record<string, { status: string }> = {};
  for (const key of ['secret_scanning', 'secret_scanning_push_protection'] as const) {
    const enabled = security[key];
    if (enabled === undefined) {
      continue;
    }
    const status = enabled ? 'enabled' : 'disabled';
    const currentStatus = currentSecurity[key]?.status;
    if (currentStatus === status) {
      continue;
    }

    securityAndAnalysis[key] = { status };
    client.record({ setting: `security.${key}`, change: formatChange(currentStatus, status) });
  }
  if (Object.keys(securityAndAnalysis).length > 0) {
    changed.security_and_analysis = securityAndAnalysis;
  }

  if (Object.keys(changed).length > 0) {
    await client.write('PATCH /repos/{owner}/{repo}', changed);
  }
}

/**
 * Applies a setting that is switched on with PUT and off with DELETE.
 *
 * @param client - The settings client.
 * @param setting - The setting name, for the change log.
 * @param route - The API route without method.
 * @param enabled - The configured state.
 * @param current - The current state.
 */
async function applyToggle(
  client: SettingsClient,
  setting: string,
  route: string,
  enabled: boolean,
  current: boolean,
): Promise<void> {
  if (current === enabled) {
    return;
  }

  client.record({ setting, change: formatChange(current, enabled) });
  await client.write(`${enabled ? 'PUT' : 'DELETE'} ${route}`);
}

/**
 * Applies the security features with their own endpoints: Dependabot alerts,
 * Dependabot security updates, and private vulnerability reporting.
 *
 * @param client - The settings client.
 * @param security - The configured security settings.
 */
export async function applySecurityFeatures(client: SettingsClient, security: SecuritySettings): Promise<void> {
  const features = [
    { key: 'dependabot_alerts', route: '/repos/{owner}/{repo}/vulnerability-alerts', statusCodes: true },
    { key: 'dependabot_security_updates', route: '/repos/{owner}/{repo}/automated-security-fixes', statusCodes: false },
    {
      key: 'private_vulnerability_reporting',
      route: '/repos/{owner}/{repo}/private-vulnerability-reporting',
      statusCodes: false,
    },
  ] as const;

  for (const { key, route, statusCodes } of features) {
    const enabled = security[key];
    if (enabled === undefined) {
      continue;
    }
    // Dependabot alerts answer with 204 or 404, the others with { enabled }.
    const current = statusCodes
      ? await client.isEnabled(`GET ${route}`)
      : (await client.read<{ enabled: boolean }>(`GET ${route}`)).enabled;
    await applyToggle(client, `security.${key}`, route, enabled, current);
  }
}

/**
 * Applies a group of settings that is read with GET and replaced with PUT.
 * The PUT request contains all keys of the group: the configured values and,
 * for the others, the current values.
 *
 * @param client - The settings client.
 * @param route - The API route without method.
 * @param keys - The keys of the group.
 * @param expected - The configured values of the group.
 */
async function applyGroup(
  client: SettingsClient,
  route: string,
  keys: readonly string[],
  expected: Record<string, unknown>,
): Promise<void> {
  const configured = Object.entries(expected).filter(([, value]) => value !== undefined);
  if (configured.length === 0) {
    return;
  }
  const current = await client.read<Record<string, unknown>>(`GET ${route}`);
  const changed = configured.filter(([key, value]) => current[key] !== value);
  for (const [key, value] of changed) {
    client.record({ setting: `actions.${key}`, change: formatChange(current[key], value) });
  }
  if (changed.length === 0) {
    return;
  }
  const body = Object.fromEntries(
    keys
      .filter(key => current[key] !== undefined || expected[key] !== undefined)
      .map(key => [key, expected[key] ?? current[key]]),
  );
  await client.write(`PUT ${route}`, body);
}

/**
 * Applies the Actions settings: permissions and the default workflow permissions.
 *
 * @param client - The settings client.
 * @param actions - The configured Actions settings.
 */
export async function applyActionsSettings(client: SettingsClient, actions: ActionsSettings): Promise<void> {
  await applyGroup(
    client,
    '/repos/{owner}/{repo}/actions/permissions',
    ['enabled', 'allowed_actions', 'sha_pinning_required'],
    {
      enabled: actions.enabled,
      allowed_actions: actions.allowed_actions,
      sha_pinning_required: actions.sha_pinning_required,
    },
  );
  await applyGroup(
    client,
    '/repos/{owner}/{repo}/actions/permissions/workflow',
    ['default_workflow_permissions', 'can_approve_pull_request_reviews'],
    {
      default_workflow_permissions: actions.default_workflow_permissions,
      can_approve_pull_request_reviews: actions.can_approve_pull_request_reviews,
    },
  );
}

/**
 * Creates or updates the configured rulesets, matched by name. Rulesets that
 * are not configured are kept.
 *
 * @param client - The settings client.
 * @param rulesets - The configured rulesets.
 */
export async function applyRulesets(client: SettingsClient, rulesets: Ruleset[]): Promise<void> {
  if (rulesets.length === 0) {
    return;
  }
  const existing = await client.read<{ id: number; name: string }[]>('GET /repos/{owner}/{repo}/rulesets', {
    includes_parents: false,
  });
  for (const ruleset of rulesets) {
    const setting = `ruleset "${ruleset.name}"`;
    const match = existing.find(({ name }) => name === ruleset.name);
    if (!match) {
      client.record({ setting, change: 'create' });
      await client.write('POST /repos/{owner}/{repo}/rulesets', { ...ruleset });
      continue;
    }
    const current = await client.read<Partial<Ruleset>>('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
      ruleset_id: match.id,
    });
    if (rulesetMatches(ruleset, current)) {
      continue;
    }

    client.record({ setting, change: 'update' });
    await client.write('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', { ruleset_id: match.id, ...ruleset });
  }
}

/**
 * Applies the immutable releases setting.
 *
 * @param client - The settings client.
 * @param enabled - The configured state.
 */
export async function applyImmutableReleases(client: SettingsClient, enabled: boolean): Promise<void> {
  const route = '/repos/{owner}/{repo}/immutable-releases';
  const current = await client.read<{ enabled: boolean }>(`GET ${route}`);
  await applyToggle(client, 'immutable_releases', route, enabled, current.enabled);
}

/**
 * Applies a settings configuration to a repository, writing only what differs.
 *
 * @param client - The settings client.
 * @param config - The configuration.
 */
export async function applySettings(client: SettingsClient, config: SettingsConfig): Promise<void> {
  const security = config.security ?? {};
  const touchesRepository =
    config.repository !== undefined ||
    security.secret_scanning !== undefined ||
    security.secret_scanning_push_protection !== undefined;

  if (touchesRepository) {
    await applyRepositorySettings(client, config.repository ?? {}, security);
  }
  await applySecurityFeatures(client, security);
  if (config.actions !== undefined) {
    await applyActionsSettings(client, config.actions);
  }
  await applyRulesets(client, config.rulesets ?? []);
  if (config.immutable_releases !== undefined) {
    await applyImmutableReleases(client, config.immutable_releases);
  }
}
