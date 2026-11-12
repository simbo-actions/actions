import {
  HTTP_STATUS_NOT_FOUND,
  IMMUTABLE_RELEASES,
  ORGANIZATION_ADMIN_ACTOR_ID,
  PUBLISHER_APP_ID,
} from './constants.ts';
import type { Core, GitHub } from './github-script.types.ts';
import { withRateLimitRetry } from './rate-limit.ts';

/**
 * A rule of a ruleset.
 */
interface Rule {
  type: string;
  parameters?: Record<string, unknown>;
}

/**
 * A bypass actor of a ruleset.
 */
interface BypassActor {
  actor_id: number;
  actor_type: string;
  bypass_mode: string;
}

/**
 * A ruleset as sent to and returned by the GitHub API.
 */
interface Ruleset {
  id?: number;
  name: string;
  target: string;
  enforcement: string;
  conditions: Record<string, unknown>;
  bypass_actors: BypassActor[];
  rules: Rule[];
}

/**
 * API route of the immutable releases setting, without method.
 */
const IMMUTABLE_RELEASES_ROUTE = '/repos/{owner}/{repo}/immutable-releases';

/**
 * Bypass actors for all rulesets: the publishing app and the owner.
 */
const BYPASS_ACTORS: BypassActor[] = [
  { actor_id: PUBLISHER_APP_ID, actor_type: 'Integration', bypass_mode: 'always' },
  { actor_id: ORGANIZATION_ADMIN_ACTOR_ID, actor_type: 'OrganizationAdmin', bypass_mode: 'always' },
];

/**
 * The rulesets of every action repository.
 */
export const RULESETS: Ruleset[] = [
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
 * Arrays must have the same items in the same order; additional object keys in
 * `actual` are ignored.
 *
 * @param expected - The expected value.
 * @param actual - The actual value.
 * @returns `true` if `actual` contains `expected`.
 */
export function matches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => matches(item, actual[index]))
    );
  }
  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) {
      return false;
    }
    const actualRecord = actual as Record<string, unknown>;
    return Object.entries(expected).every(([key, value]) => matches(value, actualRecord[key]));
  }
  return expected === actual;
}

/**
 * Checks whether a ruleset from the API matches the expected ruleset,
 * independent of the order of rules and bypass actors.
 *
 * @param expected - The expected ruleset.
 * @param actual - The ruleset from the API.
 * @returns `true` if the ruleset matches.
 */
export function rulesetMatches(expected: Ruleset, actual: Partial<Ruleset>): boolean {
  const byType = (items: Rule[]): Rule[] => items.toSorted((a, b) => a.type.localeCompare(b.type));
  const byActor = (actors: BypassActor[]): BypassActor[] =>
    actors.toSorted((a, b) => `${a.actor_type}${a.actor_id}`.localeCompare(`${b.actor_type}${b.actor_id}`));
  const { rules, bypass_actors: bypassActors, ...rest } = expected;
  return (
    matches(rest, actual) &&
    matches(byType(rules), byType(actual.rules ?? [])) &&
    matches(byActor(bypassActors), byActor(actual.bypass_actors ?? []))
  );
}

/**
 * Parameters of {@link configureActionRepository}.
 */
interface ConfigureParameters {
  github: GitHub;
  core: Core;
  owner: string;
  repo: string;
  description: string;
  homepage: string;
}

/**
 * Reads and writes settings of one repository, with rate limit handling.
 */
class RepositorySettings {
  /**
   * Number of applied changes.
   */
  public changes = 0;

  readonly #github: GitHub;
  readonly #core: Core;
  readonly #parameters: { owner: string; repo: string };

  /**
   * Creates the settings client.
   *
   * @param github - The Octokit client.
   * @param core - The `@actions/core` module.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   */
  public constructor(github: GitHub, core: Core, owner: string, repo: string) {
    this.#github = github;
    this.#core = core;
    this.#parameters = { owner, repo };
  }

  /**
   * Reads a setting.
   *
   * @param label - What is read, for log messages.
   * @param route - The API route.
   * @param options - Additional request parameters.
   * @returns The response data.
   */
  public async read<T>(label: string, route: string, options: Record<string, unknown> = {}): Promise<T> {
    const { data } = await withRateLimitRetry(this.#core, `reading ${label}`, async () =>
      this.#github.request<T>(route, { ...this.#parameters, ...options }),
    );
    return data;
  }

  /**
   * Checks whether a setting that responds with 204 or 404 is enabled.
   *
   * @param label - What is read, for log messages.
   * @param route - The API route.
   * @returns `true` for 204, `false` for 404.
   */
  public async isEnabled(label: string, route: string): Promise<boolean> {
    try {
      await this.read(label, route);
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === HTTP_STATUS_NOT_FOUND) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Writes a setting and counts the change.
   *
   * @param label - What is written, for log messages.
   * @param route - The API route.
   * @param options - Additional request parameters.
   */
  public async write(label: string, route: string, options: Record<string, unknown> = {}): Promise<void> {
    await withRateLimitRetry(this.#core, `updating ${label}`, async () =>
      this.#github.request(route, { ...this.#parameters, ...options }),
    );
    this.#core.info(`Updated ${label}.`);
    this.changes++;
  }
}

/**
 * Applies the general, merge, and secret scanning settings.
 *
 * @param settings - The settings client.
 * @param description - The repository description.
 * @param homepage - The repository homepage.
 */
async function applyGeneralSettings(
  settings: RepositorySettings,
  description: string,
  homepage: string,
): Promise<void> {
  const expected: Record<string, unknown> = {
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
  const current = await settings.read<Record<string, unknown>>('repository settings', 'GET /repos/{owner}/{repo}');
  const changed = Object.fromEntries(Object.entries(expected).filter(([key, value]) => current[key] !== value));
  const securityChanged = !matches(security, current.security_and_analysis ?? {});
  if (securityChanged || Object.keys(changed).length > 0) {
    await settings.write('repository settings', 'PATCH /repos/{owner}/{repo}', {
      ...changed,
      ...(securityChanged && { security_and_analysis: security }),
    });
  }
}

/**
 * Applies the Dependabot and vulnerability reporting settings.
 * Dependabot security updates are off: the content is overwritten by every publish.
 *
 * @param settings - The settings client.
 */
async function applySecuritySettings(settings: RepositorySettings): Promise<void> {
  if (!(await settings.isEnabled('Dependabot alerts', 'GET /repos/{owner}/{repo}/vulnerability-alerts'))) {
    await settings.write('Dependabot alerts', 'PUT /repos/{owner}/{repo}/vulnerability-alerts');
  }
  const fixes = await settings.read<{ enabled: boolean }>(
    'Dependabot security updates',
    'GET /repos/{owner}/{repo}/automated-security-fixes',
  );
  if (fixes.enabled) {
    await settings.write('Dependabot security updates', 'DELETE /repos/{owner}/{repo}/automated-security-fixes');
  }
  const reporting = await settings.read<{ enabled: boolean }>(
    'private vulnerability reporting',
    'GET /repos/{owner}/{repo}/private-vulnerability-reporting',
  );
  if (!reporting.enabled) {
    await settings.write(
      'private vulnerability reporting',
      'PUT /repos/{owner}/{repo}/private-vulnerability-reporting',
    );
  }
}

/**
 * Applies the Actions settings: SHA pinning, read-only `GITHUB_TOKEN`, no pull request approvals.
 *
 * @param settings - The settings client.
 */
async function applyActionsSettings(settings: RepositorySettings): Promise<void> {
  const permissions = { enabled: true, allowed_actions: 'all', sha_pinning_required: true };
  const current = await settings.read('Actions permissions', 'GET /repos/{owner}/{repo}/actions/permissions');
  if (!matches(permissions, current)) {
    await settings.write('Actions permissions', 'PUT /repos/{owner}/{repo}/actions/permissions', permissions);
  }
  const workflow = { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false };
  const currentWorkflow = await settings.read(
    'workflow permissions',
    'GET /repos/{owner}/{repo}/actions/permissions/workflow',
  );
  if (!matches(workflow, currentWorkflow)) {
    await settings.write('workflow permissions', 'PUT /repos/{owner}/{repo}/actions/permissions/workflow', workflow);
  }
}

/**
 * Creates or updates the rulesets, matched by name.
 *
 * @param settings - The settings client.
 */
async function applyRulesets(settings: RepositorySettings): Promise<void> {
  const existing = await settings.read<{ id: number; name: string }[]>(
    'rulesets',
    'GET /repos/{owner}/{repo}/rulesets',
    { includes_parents: false },
  );
  for (const ruleset of RULESETS) {
    const label = `ruleset "${ruleset.name}"`;
    const match = existing.find(({ name }) => name === ruleset.name);
    if (!match) {
      await settings.write(label, 'POST /repos/{owner}/{repo}/rulesets', { ...ruleset });
      continue;
    }
    const current = await settings.read<Partial<Ruleset>>(label, 'GET /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
      ruleset_id: match.id,
    });
    if (!rulesetMatches(ruleset, current)) {
      await settings.write(label, 'PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}', {
        ruleset_id: match.id,
        ...ruleset,
      });
    }
  }
}

/**
 * Applies the standard settings and rulesets to an action repository.
 * Reads the current state first and writes only what differs.
 *
 * @param parameters - The parameters.
 */
export async function configureActionRepository(parameters: ConfigureParameters): Promise<void> {
  const { github, core, owner, repo, description, homepage } = parameters;
  const settings = new RepositorySettings(github, core, owner, repo);

  await applyGeneralSettings(settings, description, homepage);
  await applySecuritySettings(settings);
  await applyActionsSettings(settings);
  await applyRulesets(settings);

  const immutable = await settings.read<{ enabled: boolean }>(
    'immutable releases',
    ['GET', IMMUTABLE_RELEASES_ROUTE].join(' '),
  );
  if (immutable.enabled !== IMMUTABLE_RELEASES) {
    const method = IMMUTABLE_RELEASES ? 'PUT' : 'DELETE';
    await settings.write('immutable releases', [method, IMMUTABLE_RELEASES_ROUTE].join(' '));
  }

  core.info(
    settings.changes === 0 ? 'All settings already applied.' : `Applied ${settings.changes} setting change(s).`,
  );
}
