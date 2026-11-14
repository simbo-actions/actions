import { describe, expect, it } from 'vitest';

import { ABOUT_CONTENTS_ENTRY, ABOUT_HEADING, checkActionReadme, REQUIRED_README_SECTIONS } from './action-readmes.ts';

const about = `${ABOUT_HEADING}\n\nPart of the organization.\n`;
const contents = `## Contents\n\n- [Usage](#usage)\n${ABOUT_CONTENTS_ENTRY}\n`;
const sections = REQUIRED_README_SECTIONS.filter(section => !ABOUT_HEADING.endsWith(section))
  .map(section => (section === 'License' ? `${about}\n## License\n\nText.\n` : `## ${section}\n\nText.\n`))
  .join('\n');
const complete = `# A\n\nIntro.\n\n${contents}\n${sections}`;

describe('checkActionReadme', () => {
  it('accepts a complete README', () => {
    expect(checkActionReadme('a', complete, about)).toEqual([]);
  });

  it('reports missing sections', () => {
    const readme = `# A\n\n${contents}\n## Usage\n\n## Inputs\n`;
    expect(checkActionReadme('a', readme, about)).toEqual([
      "a: README.md is missing the section(s): How It Works, Examples, Outputs, Token and Permissions, Security, Limitations, About Simbo's Actions, License.",
    ]);
  });

  it('reports a section about the organization that differs from the template', () => {
    expect(checkActionReadme('a', complete, `${ABOUT_HEADING}\n\nOther text.\n`)).toEqual([
      'a: README.md must contain tooling/about-section.md unchanged, directly before "License".',
    ]);
  });

  it('requires the section about the organization directly before "License"', () => {
    const readme = `# A\n\n${contents}\n${about}\n${sections.replace(about, '')}`;
    expect(checkActionReadme('a', readme, about)).toEqual([
      'a: README.md must contain tooling/about-section.md unchanged, directly before "License".',
    ]);
  });

  it('requires the section about the organization in the contents', () => {
    const readme = complete.replace(`${ABOUT_CONTENTS_ENTRY}\n`, '');
    expect(checkActionReadme('a', readme, about)).toEqual([
      `a: README.md must list "${ABOUT_CONTENTS_ENTRY}" in its contents.`,
    ]);
  });
});
