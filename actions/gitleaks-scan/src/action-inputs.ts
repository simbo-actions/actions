import { getInput } from '@actions/core';

import type { ParsedActionInputs } from './gitleaks-scan.types.js';

/**
 * Parses the action inputs from GitHub Actions.
 *
 * @returns The parsed action inputs.
 */
export function parseActionInputs(): ParsedActionInputs {
  const workingDirectory = getInput('working-directory') || '.';
  const config = getInput('config');
  return { workingDirectory, config };
}
