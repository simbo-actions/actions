import { describe, expect, it } from 'vitest';

import type { Ruleset } from './apply-repository-settings.types.js';
import { matches, rulesetMatches } from './matches.js';

describe('matches', () => {
  it('compares values, arrays, and objects recursively', () => {
    expect(matches({ a: 1, b: [1, { c: 2 }] }, { a: 1, b: [1, { c: 2, d: 3 }], e: 4 })).toBe(true);
    expect(matches({ a: 1 }, { a: 2 })).toBe(false);
    expect(matches([1, 2], [1])).toBe(false);
    expect(matches([1], 'no array')).toBe(false);
    expect(matches({ a: 1 }, null)).toBe(false);
  });
});

describe('rulesetMatches', () => {
  const ruleset: Ruleset = {
    name: 'Main Branch',
    enforcement: 'active',
    bypass_actors: [
      { actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' },
      { actor_id: 5, actor_type: 'Integration', bypass_mode: 'always' },
    ],
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0 } }, { type: 'deletion' }],
  };

  it('ignores order and additional fields from the API', () => {
    expect(
      rulesetMatches(ruleset, {
        ...ruleset,
        id: 1,
        rules: [
          { type: 'deletion' },
          { type: 'pull_request', parameters: { required_approving_review_count: 0, x: 1 } },
        ],
        bypass_actors: [...(ruleset.bypass_actors ?? [])].toReversed(),
      } as Partial<Ruleset>),
    ).toBe(true);
  });

  it('detects differences', () => {
    expect(rulesetMatches(ruleset, { ...ruleset, enforcement: 'disabled' })).toBe(false);
    expect(rulesetMatches(ruleset, { ...ruleset, rules: [] })).toBe(false);
    expect(rulesetMatches(ruleset, { ...ruleset, rules: undefined, bypass_actors: undefined })).toBe(false);
  });

  it('treats missing rules and actors as empty', () => {
    expect(rulesetMatches({ name: 'A', enforcement: 'active' }, { name: 'A', enforcement: 'active' })).toBe(true);
  });
});
