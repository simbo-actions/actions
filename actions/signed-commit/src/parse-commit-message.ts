import type { CommitMessage } from './signed-commit.types.js';

/**
 * Splits a commit message into headline (first line) and body (remaining lines).
 *
 * @param message - The full commit message.
 * @returns The headline and the optional body.
 * @throws {Error} if the headline is empty.
 */
export function parseCommitMessage(message: string): CommitMessage {
  const [firstLine = '', ...otherLines] = message.trim().split(/\r?\n/);
  const headline = firstLine.trim();

  if (!headline) {
    throw new Error('Invalid input "message": the commit message must not be empty.');
  }

  const body = otherLines.join('\n').trim();
  return body ? { headline, body } : { headline };
}
