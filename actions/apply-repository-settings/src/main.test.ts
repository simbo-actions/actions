import { info, setOutput } from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { applySettings } from './apply-settings.js';
import { createOctokit } from './create-octokit.js';
import { main } from './main.js';
import type { SettingsClient } from './settings-client.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn() }));
vi.mock('./create-octokit.js', () => ({ createOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./apply-settings.js', () => ({ applySettings: vi.fn() }));

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseActionInputs).mockResolvedValue({
      token: 'token',
      owner: 'o',
      repo: 'r',
      config: { immutable_releases: true },
      dryRun: false,
    });
  });

  it('applies the configuration and reports the changes', async () => {
    vi.mocked(applySettings).mockImplementation(async (client: SettingsClient) => {
      client.changes.push({ setting: 'immutable_releases', change: 'false → true' });
    });
    await main();

    expect(createOctokit).toHaveBeenCalledWith('token');
    expect(applySettings).toHaveBeenCalledWith(expect.anything(), { immutable_releases: true });
    expect(setOutput).toHaveBeenCalledWith('changed', 'true');
    expect(setOutput).toHaveBeenCalledWith(
      'changes',
      JSON.stringify([{ setting: 'immutable_releases', change: 'false → true' }]),
    );
    expect(info).toHaveBeenCalledWith('Applied 1 change(s) to o/r.');
  });

  it('reports a dry run', async () => {
    vi.mocked(parseActionInputs).mockResolvedValue({ token: 't', owner: 'o', repo: 'r', config: {}, dryRun: true });
    vi.mocked(applySettings).mockImplementation(async (client: SettingsClient) => {
      client.changes.push({ setting: 'x', change: 'y' });
    });
    await main();
    expect(info).toHaveBeenCalledWith('Would apply 1 change(s) to o/r.');
  });

  it('reports when nothing changes', async () => {
    vi.mocked(applySettings).mockResolvedValue();
    await main();
    expect(setOutput).toHaveBeenCalledWith('changed', 'false');
    expect(info).toHaveBeenCalledWith('All settings of o/r are already applied.');
  });
});
