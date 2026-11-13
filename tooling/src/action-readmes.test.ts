import { describe, expect, it } from 'vitest';

import { checkActionReadme, MONOREPO_URL, REQUIRED_README_SECTIONS } from './action-readmes.ts';

const note = `> [!NOTE]\n> Developed in [the monorepo](${MONOREPO_URL}) and published here automatically.\n`;
const sections = REQUIRED_README_SECTIONS.map(section => `## ${section}\n\nText.\n`).join('\n');

describe('checkActionReadme', () => {
  it('accepts a complete README', () => {
    expect(checkActionReadme('a', `# A\n\nIntro.\n\n${note}\n${sections}`)).toEqual([]);
  });

  it('reports missing sections', () => {
    const readme = `# A\n\n${note}\n## Usage\n\n## Inputs\n`;
    expect(checkActionReadme('a', readme)).toEqual([
      'a: README.md is missing the section(s): How It Works, Examples, Outputs, Token and Permissions, Security, Limitations, License.',
    ]);
  });

  it('reports a missing note', () => {
    expect(checkActionReadme('a', `# A\n\n${sections}`)).toEqual([
      'a: README.md has no note about the monorepo before the first section.',
    ]);
  });

  it('requires the note before the first section', () => {
    expect(checkActionReadme('a', `# A\n\n${sections}\n${note}`)).toEqual([
      'a: README.md has no note about the monorepo before the first section.',
    ]);
  });
});
