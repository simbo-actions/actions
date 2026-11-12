import { describe, expect, it } from 'vitest';

import { formatDependencyChangeset, getAffectedActions } from './dependency-changeset.ts';

const actions = ['signed-commit', 'github-app-bot-user'];

describe('getAffectedActions', () => {
  it('returns the actions whose package.json changed', () => {
    expect(getAffectedActions(['actions/signed-commit/package.json', 'pnpm-lock.yaml'], actions)).toEqual([
      'signed-commit',
    ]);
  });

  it('returns all actions for an update of the lockfile only', () => {
    expect(getAffectedActions(['pnpm-lock.yaml'], actions)).toEqual(['github-app-bot-user', 'signed-commit']);
  });

  it('returns no actions for other changes', () => {
    expect(getAffectedActions(['package.json', 'tooling/package.json'], actions)).toEqual([]);
    expect(getAffectedActions([], actions)).toEqual([]);
  });
});

describe('formatDependencyChangeset', () => {
  it('creates a patch changeset', () => {
    expect(formatDependencyChangeset(['github-app-bot-user', 'signed-commit'])).toBe(
      "---\n'github-app-bot-user': patch\n'signed-commit': patch\n---\n\nUpdate dependencies.\n",
    );
  });
});
