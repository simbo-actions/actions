import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Ruleset, SettingsConfig } from './apply-repository-settings.types.js';
import { applySettings } from './apply-settings.js';
import { SettingsClient, type Octokit } from './settings-client.js';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

const ruleset: Ruleset = {
  name: 'Main Branch',
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [{ actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' }],
  rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
};

const config: SettingsConfig = {
  repository: { has_issues: false, allow_squash_merge: true },
  security: {
    secret_scanning: true,
    secret_scanning_push_protection: true,
    dependabot_alerts: true,
    dependabot_security_updates: false,
    private_vulnerability_reporting: true,
  },
  actions: {
    enabled: true,
    allowed_actions: 'all',
    sha_pinning_required: true,
    default_workflow_permissions: 'read',
    can_approve_pull_request_reviews: false,
  },
  topics: ['github-actions', 'simbo-actions'],
  rulesets: [ruleset],
  immutable_releases: true,
};

/**
 * The state of a repository that matches the configuration.
 *
 * @returns The state.
 */
function configuredState(): Record<string, unknown> {
  return {
    repository: {
      has_issues: false,
      allow_squash_merge: true,
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
      },
    },
    alerts: true,
    fixes: false,
    reporting: true,
    actions: { enabled: true, allowed_actions: 'all', sha_pinning_required: true, selected_actions_url: 'x' },
    workflow: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false },
    rulesets: [{ ...ruleset, id: 7, rules: [...(ruleset.rules ?? [])].toReversed() }],
    immutable: true,
    topics: ['simbo-actions', 'github-actions'],
  };
}

/**
 * Creates a settings client for a repository state and records the write requests.
 *
 * @param state - The repository state.
 * @param dryRun - Whether to only record changes.
 * @returns The client and the write requests.
 */
function setup(
  state: Record<string, unknown>,
  dryRun = false,
): { client: SettingsClient; writes: { route: string; parameters: Record<string, unknown> }[] } {
  const writes: { route: string; parameters: Record<string, unknown> }[] = [];
  const rulesets = state.rulesets as (Ruleset & { id: number })[];
  const responses = new Map<string, () => unknown>([
    ['', () => state.repository],
    [
      '/vulnerability-alerts',
      () => {
        if (!state.alerts) {
          throw Object.assign(new Error('Not Found'), { status: 404 });
        }
        return {};
      },
    ],
    ['/automated-security-fixes', () => ({ enabled: state.fixes })],
    ['/private-vulnerability-reporting', () => ({ enabled: state.reporting })],
    ['/actions/permissions', () => state.actions],
    ['/actions/permissions/workflow', () => state.workflow],
    ['/rulesets', () => rulesets.map(({ id, name }) => ({ id, name }))],
    ['/immutable-releases', () => ({ enabled: state.immutable })],
    ['/topics', () => ({ names: state.topics })],
  ]);
  const request = vi.fn(async (route: string, parameters: Record<string, unknown>) => {
    if (!route.startsWith('GET ')) {
      writes.push({ route, parameters });
      return { data: {} };
    }
    const path = route.slice('GET /repos/{owner}/{repo}'.length);
    const data =
      path === '/rulesets/{ruleset_id}'
        ? rulesets.find(({ id }) => id === parameters.ruleset_id)
        : await responses.get(path)?.();
    return { data };
  });
  const octokit = { request } as unknown as Octokit;
  return { client: new SettingsClient(octokit, 'o', 'r', dryRun), writes };
}

describe('applySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes nothing if everything is applied', async () => {
    const { client, writes } = setup(configuredState());
    await applySettings(client, config);
    expect(writes).toEqual([]);
    expect(client.changes).toEqual([]);
  });

  it('applies all differences', async () => {
    const state = configuredState();
    Object.assign(state, {
      repository: { has_issues: true, allow_squash_merge: true, security_and_analysis: {} },
      alerts: false,
      fixes: true,
      reporting: false,
      actions: { enabled: true, allowed_actions: 'all', sha_pinning_required: false },
      workflow: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: true },
      rulesets: [],
      immutable: false,
      topics: ['old'],
    });
    const { client, writes } = setup(state);

    await applySettings(client, config);

    expect(writes.map(({ route }) => route)).toEqual([
      'PATCH /repos/{owner}/{repo}',
      'PUT /repos/{owner}/{repo}/topics',
      'PUT /repos/{owner}/{repo}/vulnerability-alerts',
      'DELETE /repos/{owner}/{repo}/automated-security-fixes',
      'PUT /repos/{owner}/{repo}/private-vulnerability-reporting',
      'PUT /repos/{owner}/{repo}/actions/permissions',
      'PUT /repos/{owner}/{repo}/actions/permissions/workflow',
      'POST /repos/{owner}/{repo}/rulesets',
      'PUT /repos/{owner}/{repo}/immutable-releases',
    ]);
    expect(writes[0].parameters).toEqual({
      owner: 'o',
      repo: 'r',
      has_issues: false,
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
      },
    });
    expect(writes[5].parameters).toEqual({
      owner: 'o',
      repo: 'r',
      enabled: true,
      allowed_actions: 'all',
      sha_pinning_required: true,
    });
    expect(client.changes).toContainEqual({ setting: 'repository.has_issues', change: 'true → false' });
    expect(client.changes).toContainEqual({ setting: 'security.secret_scanning', change: 'unset → "enabled"' });
    expect(client.changes).toContainEqual({ setting: 'ruleset "Main Branch"', change: 'create' });
    expect(writes[1].parameters).toEqual({ owner: 'o', repo: 'r', names: ['github-actions', 'simbo-actions'] });
  });

  it('keeps unconfigured values of a group', async () => {
    const state = configuredState();
    state.actions = { enabled: true, allowed_actions: 'selected', sha_pinning_required: false };
    const { client, writes } = setup(state);
    await applySettings(client, { actions: { sha_pinning_required: true } });
    expect(writes).toEqual([
      {
        route: 'PUT /repos/{owner}/{repo}/actions/permissions',
        parameters: { owner: 'o', repo: 'r', enabled: true, allowed_actions: 'selected', sha_pinning_required: true },
      },
    ]);
  });

  it('updates a ruleset that differs', async () => {
    const state = configuredState();
    (state.rulesets as Ruleset[])[0].rules = [{ type: 'deletion' }];
    const { client, writes } = setup(state);
    await applySettings(client, config);
    expect(writes).toEqual([
      {
        route: 'PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}',
        parameters: { owner: 'o', repo: 'r', ruleset_id: 7, ...ruleset },
      },
    ]);
  });

  it('applies only configured sections', async () => {
    const { client, writes } = setup({ ...configuredState(), immutable: true });
    await applySettings(client, { immutable_releases: false });
    expect(writes.map(({ route }) => route)).toEqual(['DELETE /repos/{owner}/{repo}/immutable-releases']);
  });

  it('reports but does not write in a dry run', async () => {
    const state = configuredState();
    state.immutable = false;
    const { client, writes } = setup(state, true);
    await applySettings(client, config);
    expect(writes).toEqual([]);
    expect(client.changes).toEqual([{ setting: 'immutable_releases', change: 'false → true' }]);
  });
});
