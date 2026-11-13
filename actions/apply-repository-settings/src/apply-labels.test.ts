import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../tests/fake-api.js';

import { applyLabels } from './apply-labels.js';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

const existing = [
  { name: 'bug', color: 'D73A4A', description: 'Something is broken' },
  { name: 'feature', color: 'a2eeef', description: null },
  { name: 'wontfix', color: 'ffffff', description: '' },
];

/**
 * Creates a fake API with the existing labels.
 *
 * @param dryRun - Whether to only record changes.
 * @returns The client and the write requests.
 */
function setup(dryRun = false): ReturnType<typeof fakeApi> {
  return fakeApi(new Map<string, () => unknown>([['GET /repos/{owner}/{repo}/labels', () => existing]]), dryRun);
}

describe('applyLabels', () => {
  it('writes nothing if the labels match, ignoring case', async () => {
    const { client, writes } = setup();
    await applyLabels(client, [{ name: 'bug', color: 'd73a4a', description: 'Something is broken' }], false);
    expect(writes).toEqual([]);
  });

  it('creates, updates, and renames labels', async () => {
    const { client, writes } = setup();
    await applyLabels(
      client,
      [
        { name: 'bug', color: 'ee0701' },
        { name: 'enhancement', color: 'a2eeef', description: 'New feature', old_name: 'feature' },
        { name: 'question', color: 'd876e3', description: 'Needs an answer' },
      ],
      false,
    );
    expect(writes).toEqual([
      {
        route: 'PATCH /repos/{owner}/{repo}/labels/{name}',
        parameters: { owner: 'o', repo: 'r', name: 'bug', new_name: 'bug', color: 'ee0701' },
      },
      {
        route: 'PATCH /repos/{owner}/{repo}/labels/{name}',
        parameters: {
          owner: 'o',
          repo: 'r',
          name: 'feature',
          new_name: 'enhancement',
          color: 'a2eeef',
          description: 'New feature',
        },
      },
      {
        route: 'POST /repos/{owner}/{repo}/labels',
        parameters: { owner: 'o', repo: 'r', name: 'question', color: 'd876e3', description: 'Needs an answer' },
      },
    ]);
    expect(client.changes).toEqual([
      { setting: 'label "bug"', change: 'update (color D73A4A → ee0701)' },
      { setting: 'label "enhancement"', change: 'update (name "feature" → "enhancement", description)' },
      { setting: 'label "question"', change: 'create' },
    ]);
  });

  it('deletes unconfigured labels with prune', async () => {
    const { client, writes } = setup();
    await applyLabels(client, [{ name: 'Bug', color: 'd73a4a' }], true);
    expect(writes.map(({ route, parameters }) => `${route} ${String(parameters.name)}`)).toEqual([
      'PATCH /repos/{owner}/{repo}/labels/{name} bug',
      'DELETE /repos/{owner}/{repo}/labels/{name} feature',
      'DELETE /repos/{owner}/{repo}/labels/{name} wontfix',
    ]);
  });

  it('only reports in a dry run', async () => {
    const { client, writes } = setup(true);
    await applyLabels(client, [], true);
    expect(writes).toEqual([]);
    expect(client.changes).toHaveLength(3);
  });
});
