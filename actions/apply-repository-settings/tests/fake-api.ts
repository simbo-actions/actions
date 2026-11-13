import { vi } from 'vitest';

import { SettingsClient, type Octokit } from '../src/settings-client.js';

/**
 * A write request sent to the fake API.
 */
export interface Write {
  route: string;
  parameters: Record<string, unknown>;
}

/**
 * Creates a settings client for a fake API that answers GET requests from the
 * given handlers and records all other requests.
 *
 * @param handlers - The response data per GET route, for example
 * `new Map([['GET /repos/{owner}/{repo}/labels', () => []]])`.
 * @param dryRun - Whether to only record changes.
 * @returns The client and the recorded write requests.
 */
export function fakeApi(
  handlers: Map<string, (parameters: Record<string, unknown>) => unknown>,
  dryRun = false,
): { client: SettingsClient; writes: Write[] } {
  const writes: Write[] = [];
  const request = vi.fn(async (route: string, parameters: Record<string, unknown>) => {
    if (!route.startsWith('GET ')) {
      writes.push({ route, parameters });
      return { data: {} };
    }
    const handler = handlers.get(route);
    if (!handler) {
      throw new Error(`Unexpected request: ${route}`);
    }
    return { data: handler(parameters) };
  });
  return { client: new SettingsClient({ request } as unknown as Octokit, 'o', 'r', dryRun), writes };
}
