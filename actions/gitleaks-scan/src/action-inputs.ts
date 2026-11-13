import { getInput } from '@actions/core';

import { SCOPES } from './gitleaks-scan-constants.js';
import type { ParsedActionInputs, Scope } from './gitleaks-scan.types.js';

/**
 * Parses an input that must be one of the given options.
 *
 * @param name - The input name.
 * @param options - The allowed options.
 * @param defaultValue - The value to use if the input is empty.
 * @returns The parsed option.
 * @throws {Error} if the input is not one of the options.
 */
function parseOption<T extends string>(name: string, options: readonly T[], defaultValue: T): T {
  const value = (getInput(name) || defaultValue).toLowerCase();
  if (!(options as readonly string[]).includes(value)) {
    throw new Error(`Invalid input "${name}": "${value}" (expected one of: ${options.join(', ')}).`);
  }
  return value as T;
}

/**
 * Parses a boolean input.
 *
 * @param name - The input name.
 * @param defaultValue - The value to use if the input is empty.
 * @returns The parsed boolean.
 * @throws {Error} if the input is not `true` or `false`.
 */
function parseBoolean(name: string, defaultValue: boolean): boolean {
  const value = getInput(name).toLowerCase();
  if (value === '') {
    return defaultValue;
  }
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid input "${name}": "${value}" (expected "true" or "false").`);
  }
  return value === 'true';
}

/**
 * Parses the action inputs from GitHub Actions.
 *
 * @returns The parsed action inputs.
 * @throws {Error} if an input is invalid, or "log-opts" is combined with the scope "files".
 */
export function parseActionInputs(): ParsedActionInputs {
  const workingDirectory = getInput('working-directory') || '.';
  const scope = parseOption<Scope>('scope', SCOPES, 'auto');
  const logOpts = getInput('log-opts');
  if (logOpts && scope === 'files') {
    throw new Error('Invalid input "log-opts": it selects commits and cannot be combined with the scope "files".');
  }
  const config = getInput('config');
  const baselinePath = getInput('baseline-path');
  const failOnFindings = parseBoolean('fail-on-findings', true);
  return { workingDirectory, scope, logOpts, config, baselinePath, failOnFindings };
}
