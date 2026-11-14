import { describe, expect, it } from 'vitest';

import {
  diffDependencies,
  flattenDependencies,
  formatDependencyChangeset,
  getAffectedActions,
  mergeUpdates,
} from './dependency-changeset.ts';

describe('flattenDependencies', () => {
  it('lists every package of the tree once, sorted', () => {
    expect(
      flattenDependencies({
        b: { version: '2.0.0', dependencies: { a: { version: '1.0.0' } } },
        a: { version: '1.0.0' },
        c: { version: '3.0.0', dependencies: { a: { version: '1.1.0' } } },
      }),
    ).toEqual(['a@1.0.0', 'a@1.1.0', 'b@2.0.0', 'c@3.0.0']);
  });

  it('handles missing trees and versions', () => {
    expect(flattenDependencies(undefined)).toEqual([]);
    expect(flattenDependencies({ a: {}, b: undefined })).toEqual(['a@', 'b@']);
  });
});

describe('getAffectedActions', () => {
  it('returns the actions whose production packages changed', () => {
    expect(
      getAffectedActions(
        { 'signed-commit': ['a@1.0.0'], 'staged-release': ['a@1.0.0'] },
        { 'signed-commit': ['a@1.0.1'], 'staged-release': ['a@1.0.0'] },
      ),
    ).toEqual(['signed-commit']);
  });

  it('treats a new action with dependencies as affected', () => {
    expect(getAffectedActions({}, { 'new-action': ['a@1.0.0'] })).toEqual(['new-action']);
  });

  it('returns no actions if nothing bundled changed', () => {
    expect(getAffectedActions({ a: ['x@1'] }, { a: ['x@1'] })).toEqual([]);
  });
});

describe('diffDependencies', () => {
  it('lists changed and added dependencies, sorted by name', () => {
    expect(
      diffDependencies({ b: '^1.0.0', a: '^1.0.0', c: '^1.0.0' }, { c: '^1.0.0', b: '^1.1.0', d: '^2.0.0' }),
    ).toEqual([
      { name: 'b', range: '^1.1.0' },
      { name: 'd', range: '^2.0.0' },
    ]);
  });

  it('handles missing dependency lists', () => {
    expect(diffDependencies(undefined, { a: '^1.0.0' })).toEqual([{ name: 'a', range: '^1.0.0' }]);
    expect(diffDependencies({ a: '^1.0.0' }, undefined)).toEqual([]);
  });
});

describe('mergeUpdates', () => {
  it('removes duplicates across workspaces', () => {
    expect(
      mergeUpdates(
        [
          { name: 'b', range: '^2.0.0' },
          { name: 'a', range: '^1.0.0' },
        ],
        [{ name: 'a', range: '^1.0.0' }],
      ),
    ).toEqual([
      { name: 'a', range: '^1.0.0' },
      { name: 'b', range: '^2.0.0' },
    ]);
  });
});

describe('formatDependencyChangeset', () => {
  it('describes a single update in one sentence', () => {
    expect(
      formatDependencyChangeset(['signed-commit'], [{ name: 'yaml', range: '^2.9.1' }], 'Update dependencies.'),
    ).toBe("---\n'signed-commit': patch\n---\n\nUpdate `yaml` to ^2.9.1.\n");
  });

  it('lists several updates below the summary', () => {
    expect(
      formatDependencyChangeset(
        ['changelog'],
        [
          { name: 'prettier', range: '^3.10.0' },
          { name: 'turbo', range: '^2.11.11' },
        ],
        'Update development dependencies.',
      ),
    ).toBe(
      "---\n'changelog': patch\n---\n\nUpdate development dependencies.\n\n- `prettier` to ^3.10.0\n- `turbo` to ^2.11.11\n",
    );
  });

  it('names the lockfile if no direct dependency changed', () => {
    expect(formatDependencyChangeset(['github-app-bot-user', 'signed-commit'], [], 'Update dependencies.')).toBe(
      "---\n'github-app-bot-user': patch\n'signed-commit': patch\n---\n\nUpdate the bundled dependencies in `pnpm-lock.yaml`.\n",
    );
  });
});
