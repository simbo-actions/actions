//------------------------------------------------------------------------------
// Configure Action Repository
//
// Applies the standard settings and rulesets to a published action repository.
// Runs on every publish and is idempotent: existing rulesets are updated by
// name, so manual changes are reset.
//------------------------------------------------------------------------------

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
 * Creates or updates the rulesets by name.
 *
 * @param {object} params - The parameters.
 * @param {import('@octokit/core').Octokit} params.github - The authenticated Octokit client.
 * @param {object} params.core - The `@actions/core` module.
 * @param {string} params.owner - The repository owner.
 * @param {string} params.repo - The repository name.
 */
async function applyRulesets({ github, core, owner, repo }) {
  const { data: existing } = await github.request('GET /repos/{owner}/{repo}/rulesets', {
    owner,
    repo,
    includes_parents: false,
  });

  for (const ruleset of RULESETS) {
    const current = existing.find(({ name }) => name === ruleset.name);
    if (current) {
      await github.request('PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
        owner,
        repo,
        ruleset_id: current.id,
        ...ruleset,
      });
      core.info(`Updated ruleset "${ruleset.name}".`);
    } else {
      await github.request('POST /repos/{owner}/{repo}/rulesets', { owner, repo, ...ruleset });
      core.info(`Created ruleset "${ruleset.name}".`);
    }
  }
}

/**
 * Applies the standard settings and rulesets to an action repository.
 *
 * @param {object} params - The parameters.
 * @param {import('@octokit/core').Octokit} params.github - The Octokit client with administration permission.
 * @param {object} params.core - The `@actions/core` module.
 * @param {string} params.owner - The repository owner.
 * @param {string} params.repo - The repository name.
 * @param {string} params.description - The repository description.
 * @param {string} params.homepage - The repository homepage (the source repository).
 */
export async function configureActionRepository({ github, core, owner, repo, description, homepage }) {
  const params = { owner, repo };

  // General and merge settings, secret scanning with push protection
  await github.request('PATCH /repos/{owner}/{repo}', {
    ...params,
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
    },
  });
  core.info('Applied general, merge, and secret scanning settings.');

  // Dependabot alerts on, security updates off (content is overwritten by every publish)
  await github.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', params);
  await github.request('DELETE /repos/{owner}/{repo}/automated-security-fixes', params);
  await github.request('PUT /repos/{owner}/{repo}/private-vulnerability-reporting', params);
  core.info('Applied Dependabot and vulnerability reporting settings.');

  // Actions: SHA pinning, read-only GITHUB_TOKEN, no pull request approvals
  await github.request('PUT /repos/{owner}/{repo}/actions/permissions', {
    ...params,
    enabled: true,
    allowed_actions: 'all',
    sha_pinning_required: true,
  });
  await github.request('PUT /repos/{owner}/{repo}/actions/permissions/workflow', {
    ...params,
    default_workflow_permissions: 'read',
    can_approve_pull_request_reviews: false,
  });
  core.info('Applied Actions settings.');

  await applyRulesets({ github, core, owner, repo });

  await github.request(`${IMMUTABLE_RELEASES ? 'PUT' : 'DELETE'} /repos/{owner}/{repo}/immutable-releases`, params);
  core.info(`Immutable releases ${IMMUTABLE_RELEASES ? 'enabled' : 'disabled'}.`);
}
