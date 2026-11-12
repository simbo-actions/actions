import { getInput } from '@actions/core';

import type { ParsedActionInputs } from './github-app-bot-user.types.js';

/**
 * Valid app slugs: letters, digits, and single hyphens, not at the start or end.
 */
const APP_SLUG_PATTERN = /^[\da-z]+(?:-[\da-z]+)*$/i;

/**
 * Normalizes and validates an app slug.
 *
 * @param input - The app slug, optionally with the `[bot]` suffix.
 * @returns The app slug without suffix.
 * @throws {Error} if the app slug is invalid.
 */
export function parseAppSlug(input: string): string {
  const appSlug = input.trim().replace(/\[bot\]$/i, '');
  if (!APP_SLUG_PATTERN.test(appSlug)) {
    throw new Error(`Invalid input "app-slug": "${input}" (expected the slug of a GitHub App, like "my-app").`);
  }
  return appSlug;
}

/**
 * Parses the action inputs from GitHub Actions.
 *
 * @returns The parsed action inputs.
 * @throws {Error} if an input is missing or invalid.
 */
export function parseActionInputs(): ParsedActionInputs {
  const appSlug = parseAppSlug(getInput('app-slug', { required: true }));
  const token = getInput('token', { required: true });
  return { appSlug, token };
}
