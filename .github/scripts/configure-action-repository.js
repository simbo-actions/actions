//------------------------------------------------------------------------------
// Configure Action Repository
//
// Applies the standard settings and rulesets to a published action repository.
// Runs on every publish: reads the current state first and writes only what
// differs, so manual changes are reset without unnecessary write requests.
//------------------------------------------------------------------------------

import { withRateLimitRetry } from './rate-limit.js';

/**
 * App ID of the GitHub App "simbo-actions", which publishes the actions.
 */
const PUBLISHER_APP_ID = 5_701_490;

/**
 * Actor ID of the "Organization admin" role in ruleset bypass lists.
 */
const ORGANIZATION_ADMIN_ACTOR_ID = 1;

/**
 * Whether published releases are immutable.
 * Off while the release process is introduced; then on for good.
 */
const IMMUTABLE_RELEASES = false;

/**
 * Bypass actors for all rulesets: the publishing app and the owner.
 */
const BYPASS_ACTORS = [
  { actor_id: PUBLISHER_APP_ID, actor_type: 'Integration', bypass_mode: 'always' },
  { actor_id: ORGANIZATION_ADMIN_ACTOR_ID, actor_type: 'OrganizationAdmin', bypass_mode: 'always' },
];

/**
 * The rulesets of every action repository.
 */
const RULESETS = [
  {
    name: 'Main Branch',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
    bypass_actors: BYPASS_ACTORS,
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'required_linear_history' },
      { type: 'required_signatures' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false,
          allowed_merge_methods: ['squash'],
        },
      },
    ],
  },
  {
    name: 'Release Tags',
    target: 'tag',
    enforcement: 'active',
    conditions: { ref_name: { include: ['refs/tags/v*.*.*'], exclude: [] } },
    bypass_actors: BYPASS_ACTORS,
    rules: [{ type: 'creation' }, { type: 'update' }, { type: 'deletion' }],
  },
];

/**
 * Checks whether all values of `expected` are present in `actual`, recursively.
 * Arrays must have the same items in the same order.
 *
 * @param {unknown} expected - The expected value.
 * @param {unknown} actual - The actual value.
 * @returns {boolean} `true` if `actual` contains `expected`.
 */
export function matches(expected, actual) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => matches(item, actual[index]))
    );
  }
  if (typeof expected === 'object' && expected !== null) {
    return (
      typeof actual === 'object' &&
      actual !== null &&
      Object.entries(expected).every(([key, value]) => matches(value, actual[key]))
    );
  }
  return expected === actual;
}

/**
 * Checks whether a ruleset from the API matches the expected ruleset,
 * independent of the order of rules and bypass actors.
 *
 * @param {object} expected - The expected ruleset.
 * @param {any} actual - The ruleset from the API.
 * @returns {boolean} `true` if the ruleset matches.
 */
export function rulesetMatches(expected, actual) {
  const byType = rules => [...rules].sort((a, b) => a.type.localeCompare(b.type));
  const byActor = actors =>
    [...actors].sort((a, b) => `${a.actor_type}${a.actor_id}`.localeCompare(`${b.actor_type}${b.actor_id}`));
  const { rules, bypass_actors: bypassActors, ...rest } = expected;
  return (
    matches(rest, actual) &&
    matches(byType(rules), byType(actual.rules ?? [])) &&
    matches(byActor(bypassActors), byActor(actual.bypass_actors ?? []))
  );
}

/**
 * Applies the standard settings and rulesets to an action repository.
 *
 * @param {object} params - The parameters.
 * @param {any} params.github - The Octokit client with administration permission.
 * @param {object} params.core - The `@actions/core` module.
 * @param {string} params.owner - The repository owner.
 * @param {string} params.repo - The repository name.
 * @param {string} params.description - The repository description.
 * @param {string} params.homepage - The repository homepage (the source repository).
 */
export async function configureActionRepository({ github, core, owner, repo, description, homepage }) {
  const params = { owner, repo };
  const read = async (description_, route, options = {}) =>
    withRateLimitRetry(core, `reading ${description_}`, async () => github.request(route, { ...params, ...options }));
  const write = async (description_, route, options = {}) => {
    await withRateLimitRetry(core, `updating ${description_}`, async () =>
      github.request(route, { ...params, ...options }),
    );
    core.info(`Updated ${description_}.`);
  };
  const isEnabled = async route => {
    try {
      await read(route, route);
      return true;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  };
  let changes = 0;

  // General and merge settings, secret scanning with push protection
  const settings = {
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
  };
  const security = {
    secret_scanning: { status: 'enabled' },
    secret_scanning_push_protection: { status: 'enabled' },
  };
  const { data: repository } = await read('repository settings', 'GET /repos/{owner}/{repo}');
  const changedSettings = Object.fromEntries(
    Object.entries(settings).filter(([key, value]) => repository[key] !== value),
  );
  const securityChanged = !matches(security, repository.security_and_analysis ?? {});
  if (Object.keys(changedSettings).length > 0 || securityChanged) {
    await write('repository settings', 'PATCH /repos/{owner}/{repo}', {
      ...changedSettings,
      ...(securityChanged ? { security_and_analysis: security } : {}),
    });
    changes++;
  }

  // Dependabot alerts on, security updates off (content is overwritten by every publish)
  if (!(await isEnabled('GET /repos/{owner}/{repo}/vulnerability-alerts'))) {
    await write('Dependabot alerts', 'PUT /repos/{owner}/{repo}/vulnerability-alerts');
    changes++;
  }
  const { data: securityFixes } = await read(
    'Dependabot security updates',
    'GET /repos/{owner}/{repo}/automated-security-fixes',
  );
  if (securityFixes.enabled) {
    await write('Dependabot security updates', 'DELETE /repos/{owner}/{repo}/automated-security-fixes');
    changes++;
  }
  const { data: vulnerabilityReporting } = await read(
    'private vulnerability reporting',
    'GET /repos/{owner}/{repo}/private-vulnerability-reporting',
  );
  if (!vulnerabilityReporting.enabled) {
    await write('private vulnerability reporting', 'PUT /repos/{owner}/{repo}/private-vulnerability-reporting');
    changes++;
  }

  // Actions: SHA pinning, read-only GITHUB_TOKEN, no pull request approvals
  const actionsPermissions = { enabled: true, allowed_actions: 'all', sha_pinning_required: true };
  const { data: currentActions } = await read('Actions permissions', 'GET /repos/{owner}/{repo}/actions/permissions');
  if (!matches(actionsPermissions, currentActions)) {
    await write('Actions permissions', 'PUT /repos/{owner}/{repo}/actions/permissions', actionsPermissions);
    changes++;
  }
  const workflowPermissions = { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false };
  const { data: currentWorkflow } = await read(
    'workflow permissions',
    'GET /repos/{owner}/{repo}/actions/permissions/workflow',
  );
  if (!matches(workflowPermissions, currentWorkflow)) {
    await write('workflow permissions', 'PUT /repos/{owner}/{repo}/actions/permissions/workflow', workflowPermissions);
    changes++;
  }

  // Rulesets, matched by name
  const { data: existingRulesets } = await read('rulesets', 'GET /repos/{owner}/{repo}/rulesets', {
    includes_parents: false,
  });
  for (const ruleset of RULESETS) {
    const existing = existingRulesets.find(({ name }) => name === ruleset.name);
    if (!existing) {
      await write(`ruleset "${ruleset.name}"`, 'POST /repos/{owner}/{repo}/rulesets', ruleset);
      changes++;
      continue;
    }
    const { data: current } = await read(
      `ruleset "${ruleset.name}"`,
      'GET /repos/{owner}/{repo}/rulesets/{ruleset_id}',
      {
        ruleset_id: existing.id,
      },
    );
    if (!rulesetMatches(ruleset, current)) {
      await write(`ruleset "${ruleset.name}"`, 'PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
        ruleset_id: existing.id,
        ...ruleset,
      });
      changes++;
    }
  }

  // Immutable releases
  const { data: immutable } = await read('immutable releases', 'GET /repos/{owner}/{repo}/immutable-releases');
  if (immutable.enabled !== IMMUTABLE_RELEASES) {
    await write(
      'immutable releases',
      `${IMMUTABLE_RELEASES ? 'PUT' : 'DELETE'} /repos/{owner}/{repo}/immutable-releases`,
    );
    changes++;
  }

  core.info(changes === 0 ? 'All settings already applied.' : `Applied ${changes} setting change(s).`);
}
