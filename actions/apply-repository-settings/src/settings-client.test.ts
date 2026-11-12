import { info } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsClient, type Octokit } from './settings-client.js';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

/**
 * Creates a fake Octokit client.
 *
 * @param request - The implementation of `request`.
 * @returns The fake client.
 */
function fakeOctokit(request: ReturnType<typeof vi.fn>): Octokit {
  return { request } as unknown as Octokit;
}

describe('SettingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads with the repository parameters', async () => {
    const request = vi.fn().mockResolvedValue({ data: { a: 1 } });
    const client = new SettingsClient(fakeOctokit(request), 'o', 'r', false);
    expect(await client.read('GET /x', { page: 1 })).toEqual({ a: 1 });
    expect(request).toHaveBeenCalledWith('GET /x', { owner: 'o', repo: 'r', page: 1 });
  });

  it('maps 204 and 404 to enabled and disabled', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: undefined })
      .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    const client = new SettingsClient(fakeOctokit(request), 'o', 'r', false);
    expect(await client.isEnabled('GET /x')).toBe(true);
    expect(await client.isEnabled('GET /x')).toBe(false);
    await expect(client.isEnabled('GET /x')).rejects.toThrow('Forbidden');
  });

  it('records changes and writes', async () => {
    const request = vi.fn().mockResolvedValue({ data: {} });
    const client = new SettingsClient(fakeOctokit(request), 'o', 'r', false);
    client.record({ setting: 'repository.has_issues', change: 'true → false' });
    await client.write('PATCH /x', { has_issues: false });
    expect(client.changes).toEqual([{ setting: 'repository.has_issues', change: 'true → false' }]);
    expect(info).toHaveBeenCalledWith('Changing repository.has_issues: true → false');
    expect(request).toHaveBeenCalledWith('PATCH /x', { owner: 'o', repo: 'r', has_issues: false });
  });

  it('only records changes in a dry run', async () => {
    const request = vi.fn();
    const client = new SettingsClient(fakeOctokit(request), 'o', 'r', true);
    client.record({ setting: 'immutable_releases', change: 'false → true' });
    await client.write('PUT /x');
    expect(info).toHaveBeenCalledWith('Would change immutable_releases: false → true');
    expect(request).not.toHaveBeenCalled();
  });
});
