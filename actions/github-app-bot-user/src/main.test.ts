import { info, setOutput } from '@actions/core';
import { createOctokit } from '@simbo-actions/octokit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';
import { getBotUser, toBotUser } from './get-bot-user.js';
import { main } from './main.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), setOutput: vi.fn() }));
vi.mock('@simbo-actions/octokit', () => ({ createOctokit: vi.fn(() => ({})) }));
vi.mock('./action-inputs.js', () => ({ parseActionInputs: vi.fn() }));
vi.mock('./get-bot-user.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./get-bot-user.js')>()),
  getBotUser: vi.fn(),
}));

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets all outputs', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ appSlug: 'my-app', token: 'token' });
    vi.mocked(getBotUser).mockResolvedValue(toBotUser(42, 'my-app[bot]'));

    await main();

    expect(createOctokit).toHaveBeenCalledWith('token');
    expect(getBotUser).toHaveBeenCalledWith(expect.anything(), 'my-app');
    expect(vi.mocked(setOutput).mock.calls).toEqual([
      ['id', '42'],
      ['login', 'my-app[bot]'],
      ['name', 'my-app[bot]'],
      ['email', '42+my-app[bot]@users.noreply.github.com'],
      ['author', 'my-app[bot] <42+my-app[bot]@users.noreply.github.com>'],
    ]);
    expect(info).toHaveBeenCalled();
  });

  it('fails if the bot user cannot be found', async () => {
    vi.mocked(parseActionInputs).mockReturnValue({ appSlug: 'missing', token: 'token' });
    vi.mocked(getBotUser).mockRejectedValue(new Error('No bot user found'));

    await expect(main()).rejects.toThrow('No bot user found');
    expect(setOutput).not.toHaveBeenCalled();
  });
});
