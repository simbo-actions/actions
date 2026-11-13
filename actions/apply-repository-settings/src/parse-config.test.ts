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
    ['invalid JSON', '{', 'not valid JSON'],
    ['a non-object root', '[]', '"(root)" must be an object'],
    ['unknown sections', '{"labels": []}', 'unknown key(s) in "(root)": labels'],
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
});
