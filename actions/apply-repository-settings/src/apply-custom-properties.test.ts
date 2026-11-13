import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../tests/fake-api.js';

import { applyCustomProperties } from './apply-custom-properties.js';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

/**
 * Creates a fake API with the current property values.
 *
 * @returns The client and the write requests.
 */
function setup(): ReturnType<typeof fakeApi> {
  return fakeApi(
    new Map<string, () => unknown>([
      [
        'GET /repos/{owner}/{repo}/properties/values',
        () => [
          { property_name: 'team', value: 'platform' },
          { property_name: 'regions', value: ['us', 'eu'] },
        ],
      ],
    ]),
  );
}

describe('applyCustomProperties', () => {
  it('writes nothing if the values match, lists in any order', async () => {
    const { client, writes } = setup();
    await applyCustomProperties(client, { team: 'platform', regions: ['eu', 'us'], legacy: null });
    expect(writes).toEqual([]);
  });

  it('sets the changed values in one request', async () => {
    const { client, writes } = setup();
    await applyCustomProperties(client, { team: 'security', regions: null, tier: 'gold' });
    expect(writes).toEqual([
      {
        route: 'PATCH /repos/{owner}/{repo}/properties/values',
        parameters: {
          owner: 'o',
          repo: 'r',
          properties: [
            { property_name: 'team', value: 'security' },
            { property_name: 'regions', value: null },
            { property_name: 'tier', value: 'gold' },
          ],
        },
      },
    ]);
    expect(client.changes).toEqual([
      { setting: 'custom_properties.team', change: '"platform" → "security"' },
      { setting: 'custom_properties.regions', change: '["eu","us"] → null' },
      { setting: 'custom_properties.tier', change: 'null → "gold"' },
    ]);
  });
});
