import { describe, expect, it, vi } from 'vitest';

import { toBotUser } from './get-bot-user.js';
import { writeSummary } from './summary.js';

const summary = vi.hoisted(() => {
  const fake = { addHeading: vi.fn(), addRaw: vi.fn(), write: vi.fn() };
  for (const method of [fake.addHeading, fake.addRaw]) {
    method.mockImplementation(() => fake);
  }
  return fake;
});

vi.mock('@actions/core', () => ({ summary }));

describe('writeSummary', () => {
  it('links the app and shows the Git author', async () => {
    await writeSummary(toBotUser(42, 'my-app[bot]'), 'https://github.com');
    expect(summary.addHeading).toHaveBeenCalledWith('🤖 GitHub App Bot User', 2);
    expect(summary.addRaw).toHaveBeenCalledWith(
      '✅ <a href="https://github.com/apps/my-app"><code>my-app[bot]</code></a> (ID 42)',
      true,
    );
    expect(summary.addRaw).toHaveBeenCalledWith(
      'Git author: <code>my-app[bot] &lt;42+my-app[bot]@users.noreply.github.com&gt;</code>',
      true,
    );
    expect(summary.write).toHaveBeenCalled();
  });
});
