import { vi, type Mock } from 'vitest';

import type { Core, GitHub } from './github-script.types.ts';

/**
 * Creates a fake `@actions/core` module.
 *
 * @returns The fake module with mocked functions.
 */
export function fakeCore(): Core & {
  info: Mock<(message: string) => void>;
  warning: Mock<(message: string) => void>;
  setOutput: Mock<(name: string, value: unknown) => void>;
} {
  return {
    info: vi.fn<(message: string) => void>(),
    warning: vi.fn<(message: string) => void>(),
    setOutput: vi.fn<(name: string, value: unknown) => void>(),
  };
}

/**
 * Creates an HTTP error like Octokit does.
 *
 * @param status - The HTTP status.
 * @param headers - The response headers.
 * @param message - The error message.
 * @returns The error.
 */
export function httpError(status: number, headers: Record<string, string> = {}, message = `HTTP ${status}`): Error {
  return Object.assign(new Error(message), { status, response: { headers } });
}

/**
 * A recorded API request.
 */
export interface RecordedRequest {
  route: string;
  parameters: Record<string, unknown>;
}

/**
 * Creates a fake Octokit client that answers requests with a handler and records them.
 *
 * @param handler - Returns the response data for a request, or throws.
 * @param pages - The result of `paginate`.
 * @returns The fake client and the recorded requests.
 */
export function fakeGitHub(
  handler: (route: string, parameters: Record<string, unknown>) => unknown,
  pages: unknown[] = [],
): { github: GitHub; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const request = async (
    route: string | Record<string, unknown>,
    parameters: Record<string, unknown> = {},
  ): Promise<{ data: unknown }> => {
    const key = typeof route === 'string' ? route : `${String(route.method)} ${String(route.url)}`;
    const merged = typeof route === 'string' ? parameters : route;
    requests.push({ route: key, parameters: merged });
    return { data: await handler(key, merged) };
  };
  const github = {
    request: request as GitHub['request'],
    // eslint-disable-next-line @typescript-eslint/require-await -- the fake has nothing to wait for
    paginate: (async () => pages) as GitHub['paginate'],
  };
  return { github, requests };
}
