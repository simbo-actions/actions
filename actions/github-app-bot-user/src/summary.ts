import { summary } from '@actions/core';

import type { BotUser } from './github-app-bot-user.types.js';

/**
 * Writes the bot user and its Git identity to the job summary.
 *
 * @param botUser - The bot user.
 * @param serverUrl - The URL of the GitHub server, for the profile link.
 */
export async function writeSummary(botUser: BotUser, serverUrl: string): Promise<void> {
  await summary
    .addHeading('🤖 GitHub App Bot User', 2)
    .addRaw(
      `✅ <a href="${serverUrl}/apps/${botUser.login.replace(/\[bot\]$/, '')}"><code>${botUser.login}</code></a> (ID ${botUser.id})`,
      true,
    )
    .addRaw(`Git author: <code>${botUser.author.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</code>`, true)
    .write();
}
