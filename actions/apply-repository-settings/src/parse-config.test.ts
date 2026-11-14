import { describe, expect, it } from 'vitest';

import { parseConfig } from './parse-config.js';

const ruleset = {
  name: 'Main Branch',
  target: 'branch',
  enforcement: 'active',
  conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
  rules: [{ type: 'deletion' }, { type: 'pull_request', parameters: { required_approving_review_count: 0 } }],
  bypass_actors: [
    { actor_id: 1, actor_type: 'Integration', bypass_mode: 'always' },
    { actor_id: null, actor_type: 'OrganizationAdmin' },
  ],
};

describe('parseConfig', () => {
  it('accepts an empty configuration', () => {
    expect(parseConfig('{}')).toEqual({});
  });

  it('accepts all sections', () => {
    const expected = {
      repository: {
        description: 'An action.',
        has_issues: false,
        has_pull_requests: false,
        pull_request_creation_policy: 'collaborators_only',
        allow_squash_merge: true,
      },
      topics: ['github-actions', 'simbo-actions'],
      security: { secret_scanning: true, dependabot_security_updates: false },
      actions: { enabled: true, allowed_actions: 'all', default_workflow_permissions: 'read' },
      rulesets: [ruleset],
      immutable_releases: true,
    };
    expect(parseConfig(JSON.stringify({ $schema: './schema.json', ...expected }))).toEqual(expected);
  });

  it.each([
    ['invalid YAML', '{', 'Invalid configuration: '],
    ['a non-object root', '[]', '"(root)" must be an object'],
    ['unknown sections', '{"teams": []}', 'unknown key(s) in "(root)": teams'],
    ['unknown repository keys', '{"repository": {"topics": []}}', 'unknown key(s) in "repository": topics'],
    ['wrong repository types', '{"repository": {"has_issues": "no"}}', '"repository.has_issues" must be a boolean'],
    ['a non-object section', '{"security": true}', '"security" must be an object'],
    ['wrong security types', '{"security": {"secret_scanning": "on"}}', '"security.secret_scanning" must be a boolean'],
    ['invalid actions values', '{"actions": {"allowed_actions": "some"}}', 'must be one of: all, local_only, selected'],
    ['non-array topics', '{"topics": "a"}', '"topics" must be an array'],
    ['invalid topics', '{"topics": ["Upper"]}', '"topics[0]" must be lowercase'],
    ['non-string topics', '{"topics": [1]}', '"topics[0]" must be lowercase'],
    ['duplicate topics', '{"topics": ["a", "a"]}', 'must not contain duplicates'],
    ['too many topics', JSON.stringify({ topics: Array.from({ length: 21 }, (_, i) => `t${i}`) }), 'at most 20'],
    ['non-array rulesets', '{"rulesets": {}}', '"rulesets" must be an array'],
    ['non-object rulesets', '{"rulesets": [1]}', '"rulesets[0]" must be an object'],
    ['rulesets without name', '{"rulesets": [{"enforcement": "active"}]}', '"rulesets[0].name" must be a string'],
    [
      'invalid enforcement',
      '{"rulesets": [{"name": "A", "enforcement": "on"}]}',
      '"rulesets[0].enforcement" must be one of',
    ],
    [
      'unknown ruleset keys',
      '{"rulesets": [{"name": "A", "enforcement": "active", "baseUrl": "x"}]}',
      'unknown key(s) in "rulesets[0]": baseUrl',
    ],
    [
      'invalid ruleset targets',
      '{"rulesets": [{"name": "A", "enforcement": "active", "target": "repo"}]}',
      '"rulesets[0].target" must be one of',
    ],
    [
      'unknown condition keys',
      '{"rulesets": [{"name": "A", "enforcement": "active", "conditions": {"repository_name": {}}}]}',
      'unknown key(s) in "rulesets[0].conditions": repository_name',
    ],
    [
      'unknown ref_name keys',
      '{"rulesets": [{"name": "A", "enforcement": "active", "conditions": {"ref_name": {"only": []}}}]}',
      'unknown key(s) in "rulesets[0].conditions.ref_name": only',
    ],
    [
      'non-string ref patterns',
      '{"rulesets": [{"name": "A", "enforcement": "active", "conditions": {"ref_name": {"include": [1]}}}]}',
      '"rulesets[0].conditions.ref_name.include" must be an array of strings',
    ],
    [
      'non-array rules',
      '{"rulesets": [{"name": "A", "enforcement": "active", "rules": {}}]}',
      '"rulesets[0].rules" must be an array',
    ],
    [
      'unknown rule keys',
      '{"rulesets": [{"name": "A", "enforcement": "active", "rules": [{"type": "deletion", "params": {}}]}]}',
      'unknown key(s) in "rulesets[0].rules[0]": params',
    ],
    [
      'rules without type',
      '{"rulesets": [{"name": "A", "enforcement": "active", "rules": [{}]}]}',
      '"rulesets[0].rules[0].type" must be a string',
    ],
    [
      'non-object rule parameters',
      '{"rulesets": [{"name": "A", "enforcement": "active", "rules": [{"type": "x", "parameters": 1}]}]}',
      '"rulesets[0].rules[0].parameters" must be an object',
    ],
    [
      'unknown bypass actor keys',
      '{"rulesets": [{"name": "A", "enforcement": "active", "bypass_actors": [{"actor_id": 1, "actor_type": "Integration", "mode": "always"}]}]}',
      'unknown key(s) in "rulesets[0].bypass_actors[0]": mode',
    ],
    [
      'invalid actor ids',
      '{"rulesets": [{"name": "A", "enforcement": "active", "bypass_actors": [{"actor_id": "1", "actor_type": "Integration"}]}]}',
      '"rulesets[0].bypass_actors[0].actor_id" must be a number or null',
    ],
    [
      'invalid actor types',
      '{"rulesets": [{"name": "A", "enforcement": "active", "bypass_actors": [{"actor_id": 1, "actor_type": "User"}]}]}',
      '"rulesets[0].bypass_actors[0].actor_type" must be one of',
    ],
    [
      'invalid bypass modes',
      '{"rulesets": [{"name": "A", "enforcement": "active", "bypass_actors": [{"actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "never"}]}]}',
      '"rulesets[0].bypass_actors[0].bypass_mode" must be one of',
    ],
    ['wrong immutable_releases', '{"immutable_releases": "yes"}', '"immutable_releases" must be a boolean'],
  ])('rejects %s', (_, json, error) => {
    expect(() => parseConfig(json)).toThrow(error);
  });

  it('rejects duplicate ruleset names', () => {
    expect(() => parseConfig(JSON.stringify({ rulesets: [ruleset, ruleset] }))).toThrow(
      'two rulesets are named "Main Branch"',
    );
  });

  it('reads YAML with comments', () => {
    const yaml = [
      '# Settings of the repository',
      'repository:',
      '  has_issues: false # issues go to the monorepo',
      'labels:',
      '  - name: bug',
      "    color: '#D73A4A'",
      '    description: Something is broken',
      '  - name: enhancement',
      '    color: a2eeef',
      '    old_name: feature',
      'environments:',
      '  - name: release',
      '    wait_timer: 5',
      '    prevent_self_review: true',
      '    reviewers: [{ type: Team, id: 42 }]',
      '    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }',
      '    deployment_policies:',
      '      - { name: main, type: branch }',
      "      - { name: 'v*', type: tag }",
      '  - name: preview',
      '    deployment_branch_policy: null',
      'autolinks:',
      '  - key_prefix: TICKET-',
      '    url_template: https://tracker.example.com/TICKET-<num>',
      '    is_alphanumeric: false',
      'custom_properties:',
      '  team: platform',
      '  regions: [eu, us]',
      '  legacy: null',
      'prune:',
      '  labels: true',
      '  environments: false',
    ].join('\n');
    expect(parseConfig(yaml)).toEqual({
      repository: { has_issues: false },
      labels: [
        { name: 'bug', color: 'd73a4a', description: 'Something is broken' },
        { name: 'enhancement', color: 'a2eeef', old_name: 'feature' },
      ],
      environments: [
        {
          name: 'release',
          wait_timer: 5,
          prevent_self_review: true,
          reviewers: [{ type: 'Team', id: 42 }],
          deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
          deployment_policies: [
            { name: 'main', type: 'branch' },
            { name: 'v*', type: 'tag' },
          ],
        },
        { name: 'preview', deployment_branch_policy: null },
      ],
      autolinks: [
        { key_prefix: 'TICKET-', url_template: 'https://tracker.example.com/TICKET-<num>', is_alphanumeric: false },
      ],
      custom_properties: { team: 'platform', regions: ['eu', 'us'], legacy: null },
      prune: { labels: true, environments: false },
    });
  });

  it('accepts an empty file', () => {
    expect(parseConfig('# nothing configured\n')).toEqual({});
  });

  it.each([
    ['labels without color', 'labels: [{ name: bug }]', '"labels[0].color" must be six hex digits'],
    ['invalid label colors', 'labels: [{ name: bug, color: red }]', '"labels[0].color" must be six hex digits'],
    [
      'unknown label keys',
      'labels: [{ name: bug, color: d73a4a, colour: x }]',
      'unknown key(s) in "labels[0]": colour',
    ],
    [
      'non-string descriptions',
      'labels: [{ name: bug, color: d73a4a, description: 1 }]',
      '"labels[0].description" must be a string',
    ],
    [
      'duplicate labels',
      'labels: [{ name: Bug, color: d73a4a }, { name: bug, color: d73a4a }]',
      'two entries of "labels" have the name "bug"',
    ],
    ['environments without name', 'environments: [{ wait_timer: 1 }]', '"environments[0].name" must be a string'],
    [
      'invalid wait timers',
      'environments: [{ name: a, wait_timer: 50000 }]',
      '"environments[0].wait_timer" must be minutes from 0 to 43200',
    ],
    ['fractional wait timers', 'environments: [{ name: a, wait_timer: 1.5 }]', '"environments[0].wait_timer"'],
    [
      'invalid self review',
      'environments: [{ name: a, prevent_self_review: yes }]',
      '"environments[0].prevent_self_review" must be a boolean',
    ],
    [
      'invalid reviewer types',
      'environments: [{ name: a, reviewers: [{ type: Bot, id: 1 }] }]',
      '"environments[0].reviewers[0].type" must be one of: User, Team',
    ],
    [
      'invalid reviewer ids',
      'environments: [{ name: a, reviewers: [{ type: User, id: x }] }]',
      '"environments[0].reviewers[0].id" must be a number',
    ],
    [
      'too many reviewers',
      `environments: [{ name: a, reviewers: [${Array.from({ length: 7 }, (_, id) => `{ type: User, id: ${id} }`).join(', ')}] }]`,
      'must have at most 6 entries',
    ],
    [
      'contradicting branch policies',
      'environments: [{ name: a, deployment_branch_policy: { protected_branches: true, custom_branch_policies: true } }]',
      'exactly one of "protected_branches" and "custom_branch_policies"',
    ],
    [
      'incomplete branch policies',
      'environments: [{ name: a, deployment_branch_policy: { protected_branches: true } }]',
      '"environments[0].deployment_branch_policy.custom_branch_policies" must be a boolean',
    ],
    [
      'deployment policies without custom branch policies',
      'environments: [{ name: a, deployment_policies: [{ name: main, type: branch }] }]',
      '"environments[0].deployment_policies" needs "deployment_branch_policy.custom_branch_policies: true"',
    ],
    [
      'invalid deployment policy types',
      'environments: [{ name: a, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }, deployment_policies: [{ name: main, type: commit }] }]',
      '"environments[0].deployment_policies[0].type" must be one of: branch, tag',
    ],
    [
      'secrets in environments',
      'environments: [{ name: a, secrets: {} }]',
      'unknown key(s) in "environments[0]": secrets',
    ],
    [
      'duplicate environments',
      'environments: [{ name: Release }, { name: release }]',
      'two entries of "environments" have the name "release"',
    ],
    [
      'autolinks without <num>',
      'autolinks: [{ key_prefix: T-, url_template: https://x.example/T }]',
      '"autolinks[0].url_template" must be a URL that contains "<num>"',
    ],
    [
      'autolinks without prefix',
      'autolinks: [{ url_template: https://x.example/<num> }]',
      '"autolinks[0].key_prefix" must be a string',
    ],
    [
      'invalid alphanumeric flags',
      'autolinks: [{ key_prefix: T-, url_template: https://x.example/<num>, is_alphanumeric: 1 }]',
      '"autolinks[0].is_alphanumeric" must be a boolean',
    ],
    [
      'duplicate autolinks',
      'autolinks: [{ key_prefix: T-, url_template: https://x.example/<num> }, { key_prefix: t-, url_template: https://y.example/<num> }]',
      'two entries of "autolinks" have the key_prefix "t-"',
    ],
    ['non-object custom properties', 'custom_properties: [a]', '"custom_properties" must be an object'],
    [
      'invalid custom property values',
      'custom_properties: { team: 1 }',
      '"custom_properties.team" must be a string, an array of strings, or null',
    ],
    ['unknown prune areas', 'prune: { topics: true }', 'unknown key(s) in "prune": topics'],
    ['invalid prune values', 'prune: { labels: yes }', '"prune.labels" must be a boolean'],
    [
      'pruning without a section',
      'prune: { autolinks: true }',
      '"prune.autolinks" needs the section "autolinks"; an empty list deletes all autolinks.',
    ],
  ])('rejects %s', (_, yaml, error) => {
    expect(() => parseConfig(yaml)).toThrow(error);
  });
});
