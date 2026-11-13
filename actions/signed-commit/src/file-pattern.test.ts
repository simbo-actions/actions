import { describe, expect, it } from 'vitest';

import { matchesFilePatterns } from './file-pattern.js';

describe('matchesFilePatterns', () => {
  it('matches every path without patterns', () => {
    expect(matchesFilePatterns('any/file.txt', [])).toBe(true);
  });

  it('matches paths that match an included pattern', () => {
    const patterns = ['dist/**', '*.md'];
    expect(matchesFilePatterns('dist/index.js', patterns)).toBe(true);
    expect(matchesFilePatterns('dist/sub/chunk.js', patterns)).toBe(true);
    expect(matchesFilePatterns('README.md', patterns)).toBe(true);
    expect(matchesFilePatterns('docs/guide.md', patterns)).toBe(false);
    expect(matchesFilePatterns('src/index.ts', patterns)).toBe(false);
  });

  it('excludes paths that match a pattern with "!", in any order', () => {
    expect(matchesFilePatterns('dist/index.js.map', ['!**/*.map', 'dist/**'])).toBe(false);
    expect(matchesFilePatterns('dist/index.js', ['!**/*.map', 'dist/**'])).toBe(true);
  });

  it('includes all other paths with only excluding patterns', () => {
    expect(matchesFilePatterns('src/index.ts', ['!*.lock'])).toBe(true);
    expect(matchesFilePatterns('pnpm.lock', ['!*.lock'])).toBe(false);
  });

  it('matches dot files only with an explicit dot', () => {
    expect(matchesFilePatterns('.github/workflow.yml', ['**/*.yml'])).toBe(false);
    expect(matchesFilePatterns('.github/workflow.yml', ['.github/**'])).toBe(true);
  });
});
