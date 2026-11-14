import { describe, expect, it } from 'vitest';

import { checkPrivilegedJobs, getJobs } from './privileged-jobs.ts';

const workflow = `name: Test

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: pnpm/action-setup@abc
      - run: pnpm install --frozen-lockfile

  publish:
    needs: build
    environment:
      name: release
    steps:
      # No npm code here, only prebuilt actions.
      - uses: ./release/actions/signed-commit
      - run: |
          set -euo pipefail
          git apply ../release/release.patch
`;

describe('getJobs', () => {
  it('splits the jobs by ID', () => {
    const jobs = getJobs(workflow);
    expect(Object.keys(jobs)).toEqual(['build', 'publish']);
    expect(jobs.build).toContain('      - run: pnpm install --frozen-lockfile');
  });

  it('returns nothing without jobs', () => {
    expect(getJobs('name: Test\n')).toEqual({});
  });

  it('stops at the next top-level key', () => {
    expect(Object.keys(getJobs('jobs:\n  a:\n    x: 1\nenv:\n  b:\n'))).toEqual(['a']);
  });
});

describe('checkPrivilegedJobs', () => {
  it('accepts npm code only in jobs without environment', () => {
    expect(checkPrivilegedJobs('test.yml', workflow)).toEqual([]);
  });

  it.each([
    ['uses: actions/setup-node@abc', 'uses: actions/setup-node@abc'],
    ['uses: pnpm/action-setup@abc', 'uses: pnpm/action-setup@abc'],
    ['run: pnpm install', 'run: pnpm install'],
    ['run: npx something', 'run: npx something'],
    ['run: node tooling/bin/x.ts', 'run: node tooling/bin/x.ts'],
    ['run: cd a && npm ci', 'run: cd a && npm ci'],
  ])('rejects %s in a job with an environment', (step, offending) => {
    const privileged = `jobs:\n  publish:\n    environment: release\n    steps:\n      - ${step}\n`;
    expect(checkPrivilegedJobs('test.yml', privileged)).toEqual([
      `test.yml: job "publish" has an environment but runs npm code: - ${offending}`,
    ]);
  });

  it('ignores comments and words that only contain a command name', () => {
    const privileged =
      'jobs:\n  publish:\n    environment: release\n    steps:\n      # node and pnpm run elsewhere\n      - run: echo nodes npm-free\n';
    expect(checkPrivilegedJobs('test.yml', privileged)).toEqual([]);
  });
});
