import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../tests/fake-api.js';

import { applyAutolinks } from './apply-autolinks.js';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

const existing = [
  { id: 1, key_prefix: 'TICKET-', url_template: 'https://t.example/<num>', is_alphanumeric: true },
  { id: 2, key_prefix: 'OLD-', url_template: 'https://o.example/<num>', is_alphanumeric: false },
];

/**
 * Creates a fake API with the existing autolinks.
 *
 * @returns The client and the write requests.
 */
function setup(): ReturnType<typeof fakeApi> {
  return fakeApi(new Map<string, () => unknown>([['GET /repos/{owner}/{repo}/autolinks', () => existing]]));
}

describe('applyAutolinks', () => {
  it('writes nothing if the autolinks match', async () => {
    const { client, writes } = setup();
    await applyAutolinks(client, [{ key_prefix: 'ticket-', url_template: 'https://t.example/<num>' }], false);
    expect(writes).toEqual([]);
  });

  it('creates missing and replaces changed autolinks', async () => {
    const { client, writes } = setup();
    await applyAutolinks(
      client,
      [
        { key_prefix: 'TICKET-', url_template: 'https://t.example/<num>', is_alphanumeric: false },
        { key_prefix: 'NEW-', url_template: 'https://n.example/<num>' },
      ],
      false,
    );
    expect(writes).toEqual([
      {
        route: 'DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}',
        parameters: { owner: 'o', repo: 'r', autolink_id: 1 },
      },
      {
        route: 'POST /repos/{owner}/{repo}/autolinks',
        parameters: {
          owner: 'o',
          repo: 'r',
          key_prefix: 'TICKET-',
          url_template: 'https://t.example/<num>',
          is_alphanumeric: false,
        },
      },
      {
        route: 'POST /repos/{owner}/{repo}/autolinks',
        parameters: {
          owner: 'o',
          repo: 'r',
          key_prefix: 'NEW-',
          url_template: 'https://n.example/<num>',
          is_alphanumeric: true,
        },
      },
    ]);
    expect(client.changes).toEqual([
      { setting: 'autolink "TICKET-"', change: 'replace' },
      { setting: 'autolink "NEW-"', change: 'create' },
    ]);
  });

  it('deletes unconfigured autolinks with prune', async () => {
    const { client, writes } = setup();
    await applyAutolinks(client, [{ key_prefix: 'TICKET-', url_template: 'https://t.example/<num>' }], true);
    expect(writes).toEqual([
      {
        route: 'DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}',
        parameters: { owner: 'o', repo: 'r', autolink_id: 2 },
      },
    ]);
    expect(client.changes).toEqual([{ setting: 'autolink "OLD-"', change: 'delete' }]);
  });
});
