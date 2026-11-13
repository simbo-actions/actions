import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../tests/fake-api.js';

import { applyEnvironments } from './apply-environments.js';

vi.mock('@actions/core', () => ({ info: vi.fn() }));

const release = {
  name: 'release',
  protection_rules: [
    { type: 'wait_timer', wait_timer: 5 },
    {
      type: 'required_reviewers',
      prevent_self_review: true,
      reviewers: [
        { type: 'User', reviewer: { id: 2, login: 'b' } },
        { type: 'Team', reviewer: { id: 1, slug: 'a' } },
      ],
    },
    { type: 'branch_policy' },
  ],
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
};
const preview = { name: 'preview', deployment_branch_policy: null };

/**
 * Creates a fake API with the existing environments and deployment policies.
 *
 * @returns The client and the write requests.
 */
function setup(): ReturnType<typeof fakeApi> {
  return fakeApi(
    new Map<string, () => unknown>([
      ['GET /repos/{owner}/{repo}/environments', () => ({ environments: [release, preview] })],
      [
        'GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies',
        () => ({
          branch_policies: [
            { id: 10, name: 'main', type: 'branch' },
            { id: 11, name: 'old/*' },
          ],
        }),
      ],
    ]),
  );
}

describe('applyEnvironments', () => {
  it('writes nothing if the environments match, reviewers in any order', async () => {
    const { client, writes } = setup();
    await applyEnvironments(
      client,
      [
        {
          name: 'Release',
          wait_timer: 5,
          reviewers: [
            { type: 'Team', id: 1 },
            { type: 'User', id: 2 },
          ],
          deployment_policies: [
            { name: 'main', type: 'branch' },
            { name: 'old/*', type: 'branch' },
          ],
        },
        { name: 'preview' },
      ],
      false,
    );
    expect(writes).toEqual([]);
  });

  it('creates a missing environment with defaults for unconfigured settings', async () => {
    const { client, writes } = setup();
    await applyEnvironments(client, [{ name: 'staging', wait_timer: 10 }], false);
    expect(writes).toEqual([
      {
        route: 'PUT /repos/{owner}/{repo}/environments/{environment_name}',
        parameters: {
          owner: 'o',
          repo: 'r',
          environment_name: 'staging',
          wait_timer: 10,
          prevent_self_review: false,
          reviewers: [],
          deployment_branch_policy: null,
        },
      },
    ]);
    expect(client.changes).toEqual([{ setting: 'environment "staging"', change: 'create' }]);
  });

  it('updates an environment and keeps its unconfigured settings', async () => {
    const { client, writes } = setup();
    await applyEnvironments(client, [{ name: 'release', prevent_self_review: false }], false);
    expect(writes).toEqual([
      {
        route: 'PUT /repos/{owner}/{repo}/environments/{environment_name}',
        parameters: {
          owner: 'o',
          repo: 'r',
          environment_name: 'release',
          wait_timer: 5,
          prevent_self_review: false,
          reviewers: [
            { type: 'User', id: 2 },
            { type: 'Team', id: 1 },
          ],
          deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
        },
      },
    ]);
  });

  it('updates the deployment branch policy of an environment without rules', async () => {
    const { client, writes } = setup();
    await applyEnvironments(
      client,
      [{ name: 'preview', deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } }],
      false,
    );
    expect(writes[0].parameters).toMatchObject({
      environment_name: 'preview',
      wait_timer: 0,
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
    });
  });

  it('creates missing and deletes other deployment policies', async () => {
    const { client, writes } = setup();
    await applyEnvironments(
      client,
      [
        {
          name: 'release',
          deployment_policies: [
            { name: 'main', type: 'branch' },
            { name: 'v*', type: 'tag' },
          ],
        },
      ],
      false,
    );
    expect(writes).toEqual([
      {
        route: 'POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies',
        parameters: { owner: 'o', repo: 'r', environment_name: 'release', name: 'v*', type: 'tag' },
      },
      {
        route:
          'DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}',
        parameters: { owner: 'o', repo: 'r', environment_name: 'release', branch_policy_id: 11 },
      },
    ]);
    expect(client.changes).toEqual([
      { setting: 'environment "release" tag "v*"', change: 'create' },
      { setting: 'environment "release" branch "old/*"', change: 'delete' },
    ]);
  });

  it('deletes unconfigured environments with prune', async () => {
    const { client, writes } = setup();
    await applyEnvironments(client, [{ name: 'release' }], true);
    expect(writes).toEqual([
      {
        route: 'DELETE /repos/{owner}/{repo}/environments/{environment_name}',
        parameters: { owner: 'o', repo: 'r', environment_name: 'preview' },
      },
    ]);
  });
});
