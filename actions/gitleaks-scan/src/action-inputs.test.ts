import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';

describe('parseActionInputs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    expect(parseActionInputs()).toEqual({
      workingDirectory: '.',
      scope: 'auto',
      logOpts: '',
      config: '',
      baselinePath: '',
      failOnFindings: true,
    });
  });

  it('parses all inputs', () => {
    vi.stubEnv('INPUT_WORKING-DIRECTORY', 'repo');
    vi.stubEnv('INPUT_SCOPE', 'History');
    vi.stubEnv('INPUT_LOG-OPTS', '--since=2024-01-01');
    vi.stubEnv('INPUT_CONFIG', 'gitleaks.toml');
    vi.stubEnv('INPUT_BASELINE-PATH', 'baseline.json');
    vi.stubEnv('INPUT_FAIL-ON-FINDINGS', 'false');
    expect(parseActionInputs()).toEqual({
      workingDirectory: 'repo',
      scope: 'history',
      logOpts: '--since=2024-01-01',
      config: 'gitleaks.toml',
      baselinePath: 'baseline.json',
      failOnFindings: false,
    });
  });

  it('rejects an unknown scope', () => {
    vi.stubEnv('INPUT_SCOPE', 'all');
    expect(() => parseActionInputs()).toThrow(
      'Invalid input "scope": "all" (expected one of: auto, changes, history, files).',
    );
  });

  it('rejects an invalid boolean', () => {
    vi.stubEnv('INPUT_FAIL-ON-FINDINGS', 'yes');
    expect(() => parseActionInputs()).toThrow('Invalid input "fail-on-findings": "yes" (expected "true" or "false").');
  });

  it('rejects log options with the scope "files"', () => {
    vi.stubEnv('INPUT_SCOPE', 'files');
    vi.stubEnv('INPUT_LOG-OPTS', 'HEAD~3..HEAD');
    expect(() => parseActionInputs()).toThrow('cannot be combined with the scope "files"');
  });
});
