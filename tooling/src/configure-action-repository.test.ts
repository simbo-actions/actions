import { describe, expect, it, vi } from 'vitest';

import { configureActionRepository, matches, rulesetMatches, RULESETS } from './configure-action-repository.ts';
import { fakeCore, fakeGitHub, httpError } from './test-helpers.ts';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));

const description = 'An action.';
const homepage = 'https://github.com/simbo-actions/actions';

/**
 * Deeply copies a JSON value.
 *
 * @param value - The value.
 * @returns The copy.
 */
function clone<T>(value: T): T {
  return globalThis.structuredClone(value);
}

/**
 * Returns rulesets as the API would: reordered rules and actors, additional fields.
 *
 * @returns The rulesets with IDs.
 */
function apiRulesets(): Record<string, unknown>[] {
  return RULESETS.map((ruleset, index) => ({
    ...clone(ruleset),
    id: index + 1,
    source: 'simbo-actions/example',
    rules: clone(ruleset.rules)
      .toReversed()
      .map(rule => (rule.parameters ? { ...rule, parameters: { ...rule.parameters, extra: true } } : rule)),
    bypass_actors: clone(ruleset.bypass_actors).toReversed(),
  }));
}

/**
 * The state of a fully configured repository.
 *
 * @returns The state.
 */
function configuredState(): Record<string, unknown> {
  return {
    repository: {
      description,
      homepage,
      has_issues: false,
      has_wiki: false,
      has_projects: false,
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      allow_auto_merge: true,
      allow_update_branch: true,
      delete_branch_on_merge: true,
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
        dependabot_security_updates: { status: 'disabled' },
      },
    },
    alerts: true,
    fixes: false,
    reporting: true,
    actions: { enabled: true, allowed_actions: 'all', sha_pinning_required: true, selected_actions_url: 'x' },
    workflow: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false },
    rulesets: apiRulesets(),
    immutable: false,
  };
}

/**
 * Creates a fake GitHub client for a repository state.
 *
 * @param state - The repository state.
 * @returns The fake client and the recorded requests.
 */
function fakeRepository(state: Record<string, unknown>): ReturnType<typeof fakeGitHub> {
  const rulesets = state.rulesets as { id: number; name: string }[];
  return fakeGitHub((route, parameters) => {
    if (!route.startsWith('GET ')) {
      return {};
    }
    const path = route.slice('GET /repos/{owner}/{repo}'.length);
    switch (path) {
      case '': {
        return state.repository;
      }
      case '/vulnerability-alerts': {
        if (!state.alerts) {
          throw httpError(404);
        }
        return {};
      }
      case '/automated-security-fixes': {
        return { enabled: state.fixes };
      }
      case '/private-vulnerability-reporting': {
        return { enabled: state.reporting };
      }
      case '/actions/permissions': {
        return state.actions;
      }
      case '/actions/permissions/workflow': {
        return state.workflow;
      }
      case '/rulesets': {
        return rulesets.map(({ id, name }) => ({ id, name }));
      }
      case '/rulesets/{ruleset_id}': {
        return rulesets.find(({ id }) => id === parameters.ruleset_id);
      }
      case '/immutable-releases': {
        return { enabled: state.immutable };
      }
      default: {
        throw new Error(`Unexpected route: ${route}`);
      }
    }
  });
}

/**
 * Runs the configuration and returns the write requests.
 *
 * @param state - The repository state.
 * @returns The write requests and the fake core.
 */
async function configure(
  state: Record<string, unknown>,
): Promise<{ writes: { route: string; parameters: Record<string, unknown> }[]; core: ReturnType<typeof fakeCore> }> {
  const core = fakeCore();
  const { github, requests } = fakeRepository(state);
  await configureActionRepository({ github, core, owner: 'simbo-actions', repo: 'example', description, homepage });
  return { writes: requests.filter(({ route }) => !route.startsWith('GET ')), core };
}

describe('matches', () => {
  it('compares values, arrays, and objects recursively', () => {
    expect(matches({ a: 1, b: [1, { c: 2 }] }, { a: 1, b: [1, { c: 2, d: 3 }], e: 4 })).toBe(true);
    expect(matches({ a: 1 }, { a: 2 })).toBe(false);
    expect(matches([1, 2], [1])).toBe(false);
    expect(matches([1], 'not an array')).toBe(false);
    expect(matches({ a: 1 }, null)).toBe(false);
  });
});

describe('rulesetMatches', () => {
  it('ignores the order of rules and bypass actors', () => {
    expect(rulesetMatches(RULESETS[0], apiRulesets()[0])).toBe(true);
  });

  it('detects missing rules and actors', () => {
    expect(rulesetMatches(RULESETS[0], { ...apiRulesets()[0], rules: [] })).toBe(false);
    expect(rulesetMatches(RULESETS[0], { ...apiRulesets()[0], bypass_actors: undefined })).toBe(false);
    expect(rulesetMatches(RULESETS[0], { ...apiRulesets()[0], rules: undefined })).toBe(false);
  });
});

describe('configureActionRepository', () => {
  it('writes nothing if everything is configured', async () => {
    const { writes, core } = await configure(configuredState());
    expect(writes).toEqual([]);
    expect(core.info).toHaveBeenCalledWith('All settings already applied.');
  });

  it('configures a new repository', async () => {
    const state = configuredState();
    state.repository = { has_issues: true, has_wiki: true };
    Object.assign(state, {
      alerts: false,
      fixes: true,
      reporting: false,
      actions: { enabled: true, allowed_actions: 'all', sha_pinning_required: false },
      workflow: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: true },
      rulesets: [],
      immutable: true,
    });

    const { writes, core } = await configure(state);

    expect(writes.map(({ route }) => route)).toEqual([
      'PATCH /repos/{owner}/{repo}',
      'PUT /repos/{owner}/{repo}/vulnerability-alerts',
      'DELETE /repos/{owner}/{repo}/automated-security-fixes',
      'PUT /repos/{owner}/{repo}/private-vulnerability-reporting',
      'PUT /repos/{owner}/{repo}/actions/permissions',
      'PUT /repos/{owner}/{repo}/actions/permissions/workflow',
      'POST /repos/{owner}/{repo}/rulesets',
      'POST /repos/{owner}/{repo}/rulesets',
      'DELETE /repos/{owner}/{repo}/immutable-releases',
    ]);
    expect(writes[0].parameters).toMatchObject({
      description,
      homepage,
      has_issues: false,
      security_and_analysis: { secret_scanning: { status: 'enabled' } },
    });
    expect(core.info).toHaveBeenCalledWith('Applied 9 setting change(s).');
  });

  it('writes only the settings that differ', async () => {
    const state = configuredState();
    (state.repository as Record<string, unknown>).allow_merge_commit = true;
    const { writes } = await configure(state);
    expect(writes).toHaveLength(1);
    expect(writes[0].parameters).toEqual({ owner: 'simbo-actions', repo: 'example', allow_merge_commit: false });
  });

  it('updates a ruleset that differs', async () => {
    const state = configuredState();
    const rulesets = state.rulesets as { rules: unknown[] }[];
    rulesets[0].rules.pop();
    const { writes } = await configure(state);
    expect(writes.map(({ route }) => route)).toEqual(['PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}']);
    expect(writes[0].parameters).toMatchObject({ ruleset_id: 1, name: 'Main Branch' });
  });

  it('passes other errors through', async () => {
    const core = fakeCore();
    const { github } = fakeGitHub(() => {
      throw httpError(500);
    });
    await expect(
      configureActionRepository({ github, core, owner: 'o', repo: 'r', description, homepage }),
    ).rejects.toThrow('HTTP 500');
  });

  it('passes errors of 204/404 settings through', async () => {
    const state = configuredState();
    const { github } = fakeGitHub(route => {
      if (route.endsWith('/vulnerability-alerts')) {
        throw httpError(403);
      }
      return state.repository;
    });
    await expect(
      configureActionRepository({ github, core: fakeCore(), owner: 'o', repo: 'r', description, homepage }),
    ).rejects.toThrow('HTTP 403');
  });
});
