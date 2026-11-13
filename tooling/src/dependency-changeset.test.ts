import { describe, expect, it } from 'vitest';

import { flattenDependencies, formatDependencyChangeset, getAffectedActions } from './dependency-changeset.ts';

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

describe('formatDependencyChangeset', () => {
  it('creates a patch changeset', () => {
    expect(formatDependencyChangeset(['github-app-bot-user', 'signed-commit'])).toBe(
      "---\n'github-app-bot-user': patch\n'signed-commit': patch\n---\n\nUpdate dependencies.\n",
    );
  });
});
