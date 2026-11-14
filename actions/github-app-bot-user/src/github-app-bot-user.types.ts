/**
 * Parsed inputs for the github-app-bot-user action.
 */
export interface ParsedActionInputs {
  /**
   * The app slug, without the `[bot]` suffix.
   */
  appSlug: string;

  /**
   * The token for the API request.
   */
  token: string;
}

/**
 * The bot user of a GitHub App and its Git identity.
 */
export interface BotUser {
  /**
   * The user ID of the bot user.
   */
  id: number;

  /**
   * The login of the bot user, for example `my-app[bot]`.
   */
  login: string;

  /**
   * The name for Git, same as the login.
   */
  name: string;

  /**
   * The noreply email for Git, for example `123+my-app[bot]@users.noreply.github.com`.
   */
  email: string;

  /**
   * Name and email in the format `Name <email>`.
   */
  author: string;
}
