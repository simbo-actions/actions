import { info, setOutput } from '@actions/core';

import { parseActionInputs } from './action-inputs.js';
import { createOctokit } from './create-octokit.js';
import { getBotUser } from './get-bot-user.js';

/**
 * Main entry point for the github-app-bot-user action.
 *
 * @throws {Error} if an input is invalid or the bot user cannot be found.
 */
export async function main(): Promise<void> {
  const { appSlug, token } = parseActionInputs();
  const botUser = await getBotUser(createOctokit(token), appSlug);

  setOutput('id', String(botUser.id));
  setOutput('login', botUser.login);
  setOutput('name', botUser.name);
  setOutput('email', botUser.email);
  setOutput('author', botUser.author);

  info(`Bot user of "${appSlug}": ${botUser.author} (ID ${botUser.id}).`);
}
