import { ALL_BRANCHES } from './apply-repository-settings-constants.js';
import type { DeploymentPolicy, Environment, EnvironmentReviewer } from './apply-repository-settings.types.js';
import { matches } from './matches.js';
import type { SettingsClient } from './settings-client.js';

/**
 * An environment as returned by the GitHub API.
 */
interface CurrentEnvironment {
  name: string;
  protection_rules?: {
    type: string;
    wait_timer?: number;
    prevent_self_review?: boolean;
    reviewers?: { type: EnvironmentReviewer['type']; reviewer: { id: number } }[];
  }[];
  deployment_branch_policy?: Environment['deployment_branch_policy'];
}

/**
 * A deployment policy as returned by the GitHub API; older ones have no type.
 */
interface CurrentDeploymentPolicy {
  id: number;
  name: string;
  type?: DeploymentPolicy['type'];
}

/**
 * The settings of an environment that one PUT request replaces.
 */
type EnvironmentSettings = Required<Omit<Environment, 'name' | 'deployment_policies'>>;

/**
 * The settings of a new environment: no protection, all branches.
 */
const NEW_ENVIRONMENT: EnvironmentSettings = {
  wait_timer: 0,
  prevent_self_review: false,
  reviewers: [],
  deployment_branch_policy: ALL_BRANCHES,
};

/**
 * Reads the settings of an environment from the API response.
 *
 * @param current - The environment from the API.
 * @returns The settings in the format of the configuration.
 */
function currentSettings(current: CurrentEnvironment): EnvironmentSettings {
  const rules = current.protection_rules ?? [];
  const reviewersRule = rules.find(({ type }) => type === 'required_reviewers');
  return {
    wait_timer: rules.find(({ type }) => type === 'wait_timer')?.wait_timer ?? 0,
    prevent_self_review: reviewersRule?.prevent_self_review ?? false,
    reviewers: (reviewersRule?.reviewers ?? []).map(({ type, reviewer }) => ({ type, id: reviewer.id })),
    deployment_branch_policy: current.deployment_branch_policy ?? ALL_BRANCHES,
  };
}

/**
 * Sorts reviewers for a comparison independent of their order.
 *
 * @param settings - The settings with reviewers.
 * @returns The settings with sorted reviewers.
 */
function withSortedReviewers(settings: EnvironmentSettings): EnvironmentSettings {
  return {
    ...settings,
    reviewers: settings.reviewers.toSorted((a, b) => `${a.type}${a.id}`.localeCompare(`${b.type}${b.id}`)),
  };
}

/**
 * Checks whether a deployment policy from the API is the configured one.
 *
 * @param policy - The configured policy.
 * @param current - The policy from the API.
 * @returns `true` if name and type match.
 */
function samePolicy(policy: DeploymentPolicy, current: CurrentDeploymentPolicy): boolean {
  return policy.name === current.name && policy.type === (current.type ?? 'branch');
}

/**
 * Applies the branches and tags that may deploy to an environment: creates
 * the missing ones and deletes the others.
 *
 * @param client - The settings client.
 * @param environment - The environment name.
 * @param policies - The configured branch and tag patterns.
 */
async function applyDeploymentPolicies(
  client: SettingsClient,
  environment: string,
  policies: DeploymentPolicy[],
): Promise<void> {
  const parameters = { environment_name: environment };
  const existing = await client.readAll<CurrentDeploymentPolicy>(
    'GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies',
    'branch_policies',
    parameters,
  );
  const missing = policies.filter(policy => existing.every(current => !samePolicy(policy, current)));
  for (const policy of missing) {
    client.record({ setting: `environment "${environment}" ${policy.type} "${policy.name}"`, change: 'create' });
    await client.write('POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies', {
      ...parameters,
      ...policy,
    });
  }
  const unconfigured = existing.filter(current => policies.every(policy => !samePolicy(policy, current)));
  for (const { id, name, type = 'branch' } of unconfigured) {
    client.record({ setting: `environment "${environment}" ${type} "${name}"`, change: 'delete' });
    await client.write(
      'DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}',
      { ...parameters, branch_policy_id: id },
    );
  }
}

/**
 * Creates or updates one environment and its deployment policies.
 *
 * @param client - The settings client.
 * @param environment - The configured environment.
 * @param current - The environment from the API, or `undefined` if it is missing.
 */
async function applyEnvironment(
  client: SettingsClient,
  environment: Environment,
  current: CurrentEnvironment | undefined,
): Promise<void> {
  const { name: configuredName, deployment_policies: policies, ...configured } = environment;
  const name = current?.name ?? configuredName;
  // A PUT replaces all settings, so unconfigured ones keep their current value.
  const base = current ? currentSettings(current) : NEW_ENVIRONMENT;
  const expected = { ...base, ...configured };
  if (!current || !matches(withSortedReviewers(expected), withSortedReviewers(base))) {
    client.record({ setting: `environment "${name}"`, change: current ? 'update' : 'create' });
    await client.write('PUT /repos/{owner}/{repo}/environments/{environment_name}', {
      environment_name: name,
      ...expected,
    });
  }
  if (policies !== undefined) {
    await applyDeploymentPolicies(client, name, policies);
  }
}

/**
 * Creates and updates the configured environments, matched by name (ignoring
 * case), with their protection rules and deployment policies. Secrets and
 * variables are not touched. With `prune`, deletes all other environments,
 * including their secrets.
 *
 * @param client - The settings client.
 * @param environments - The configured environments.
 * @param prune - Whether to delete environments that are not configured.
 */
export async function applyEnvironments(
  client: SettingsClient,
  environments: Environment[],
  prune: boolean,
): Promise<void> {
  const existing = await client.readAll<CurrentEnvironment>('GET /repos/{owner}/{repo}/environments', 'environments');
  const kept = new Set<CurrentEnvironment>();
  for (const environment of environments) {
    const current = existing.find(item => item.name.toLowerCase() === environment.name.toLowerCase());
    if (current) {
      kept.add(current);
    }
    await applyEnvironment(client, environment, current);
  }

  if (!prune) {
    return;
  }
  const unconfigured = existing.filter(item => !kept.has(item));
  for (const { name } of unconfigured) {
    client.record({ setting: `environment "${name}"`, change: 'delete' });
    await client.write('DELETE /repos/{owner}/{repo}/environments/{environment_name}', { environment_name: name });
  }
}
