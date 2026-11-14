import type { Octokit } from './create-octokit.js';
import { HTTP_STATUS_NOT_FOUND } from './github-app-bot-user-constants.js';
import type { BotUser } from './github-app-bot-user.types.js';

export type { Octokit } from './create-octokit.js';

/**
 * Checks whether an error is an HTTP error with the given status.
 *
 * @param error - The error to check.
 * @param status - The expected HTTP status.
 * @returns `true` if the error has the given status.
 */
function hasStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

/**
 * Builds the Git identity of a bot user.
 *
 * @param id - The user ID.
 * @param login - The login, for example `my-app[bot]`.
 * @returns The bot user with name, email, and author.
 */
export function toBotUser(id: number, login: string): BotUser {
  const email = `${id}+${login}@users.noreply.github.com`;
  return { id, login, name: login, email, author: `${login} <${email}>` };
}

/**
 * Looks up the bot user of a GitHub App.
 *
 * @param octokit - The Octokit client.
 * @param appSlug - The app slug, without the `[bot]` suffix.
 * @returns The bot user.
 * @throws {Error} if no bot user exists for the app slug.
 */
export async function getBotUser(octokit: Octokit, appSlug: string): Promise<BotUser> {
  const login = `${appSlug}[bot]`;

  let user: { id: number; login: string; type: string };
  try {
    ({ data: user } = await octokit.rest.users.getByUsername({ username: login }));
  } catch (error) {
    if (hasStatus(error, HTTP_STATUS_NOT_FOUND)) {
      throw new Error(`No bot user found for the app slug "${appSlug}" (${login}).`, { cause: error });
    }
    throw error;
  }

  if (user.type !== 'Bot' || user.login.toLowerCase() !== login.toLowerCase()) {
    throw new Error(`The user "${user.login}" is not the bot user of the app "${appSlug}".`);
  }

  return toBotUser(user.id, user.login);
}
