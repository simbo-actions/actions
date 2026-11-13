import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseActionInputs } from './action-inputs.js';

describe('parseActionInputs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    expect(parseActionInputs()).toEqual({ workingDirectory: '.', config: '' });
  });

  it('parses all inputs', () => {
    vi.stubEnv('INPUT_WORKING-DIRECTORY', 'repo');
    vi.stubEnv('INPUT_CONFIG', 'gitleaks.toml');
    expect(parseActionInputs()).toEqual({ workingDirectory: 'repo', config: 'gitleaks.toml' });
  });
});
