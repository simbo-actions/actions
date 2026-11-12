import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publishRelease } from './publish-release.ts';
import { fakeCore, fakeGitHub } from './test-helpers.ts';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }));

describe('publishRelease', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'publish-release-'));
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'notes.md'), '### Major Changes\n\n- Initial release\n');
    await writeFile(join(directory, 'assets', 'b.tar.gz'), 'archive');
    await writeFile(join(directory, 'assets', 'SHA256SUMS'), 'sums');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  /**
   * Runs `publishRelease` with existing releases.
   *
   * @param existing - The existing releases.
   * @returns The recorded requests and the fake core.
   */
  async function run(
    existing: unknown[] = [],
  ): Promise<ReturnType<typeof fakeGitHub> & { core: ReturnType<typeof fakeCore> }> {
    const core = fakeCore();
    const responses: Record<string, unknown> = {
      'POST /repos/{owner}/{repo}/releases': {
        id: 9,
        upload_url: 'https://uploads.github.com/repos/o/r/releases/9/assets{?name,label}',
      },
      'PATCH /repos/{owner}/{repo}/releases/{release_id}': {
        id: 9,
        html_url: 'https://github.com/o/r/releases/tag/v1.0.0',
      },
    };
    const fake = fakeGitHub(route => responses[route] ?? {}, existing);
    await publishRelease({
      github: fake.github,
      core,
      owner: 'o',
      repo: 'r',
      tag: 'v1.0.0',
      name: 'r v1.0.0',
      notesFile: join(directory, 'notes.md'),
      assetsDirectory: join(directory, 'assets'),
    });
    return { ...fake, core };
  }

  it('creates a draft, uploads the assets in order, and publishes it', async () => {
    const { requests, core } = await run();

    expect(requests.map(({ route }) => route)).toEqual([
      'POST /repos/{owner}/{repo}/releases',
      'POST https://uploads.github.com/repos/o/r/releases/9/assets{?name,label}',
      'POST https://uploads.github.com/repos/o/r/releases/9/assets{?name,label}',
      'PATCH /repos/{owner}/{repo}/releases/{release_id}',
    ]);
    expect(requests[0].parameters).toMatchObject({
      tag_name: 'v1.0.0',
      name: 'r v1.0.0',
      body: '### Major Changes\n\n- Initial release\n',
      draft: true,
    });
    expect(requests.slice(1, 3).map(({ parameters }) => parameters.name)).toEqual(['b.tar.gz', 'SHA256SUMS']);
    expect(requests[1].parameters).toMatchObject({
      headers: { 'content-type': 'application/octet-stream', 'content-length': 7 },
    });
    expect(requests[3].parameters).toMatchObject({ release_id: 9, draft: false, make_latest: 'true' });
    expect(core.setOutput).toHaveBeenCalledWith('url', 'https://github.com/o/r/releases/tag/v1.0.0');
  });

  it('removes leftover drafts of the tag', async () => {
    const { requests } = await run([
      { id: 3, tag_name: 'v1.0.0', draft: true },
      { id: 4, tag_name: 'v0.9.0', draft: false },
    ]);
    expect(requests[0]).toEqual({
      route: 'DELETE /repos/{owner}/{repo}/releases/{release_id}',
      parameters: { owner: 'o', repo: 'r', release_id: 3 },
    });
  });

  it('fails if the tag is already released', async () => {
    await expect(
      run([{ id: 3, tag_name: 'v1.0.0', draft: false, html_url: 'https://github.com/o/r/releases/tag/v1.0.0' }]),
    ).rejects.toThrow('A published release for v1.0.0 already exists');
  });
});
