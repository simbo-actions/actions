import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkActionLicenses, getCopyrightYear, getLicenseLinkYears } from './action-licenses.ts';

const license = (year: string): string => `The MIT License (MIT)\n\nCopyright © ${year} Simon Lepel <simbo@simbo.de>\n`;
const readme = (link: string): string => `# Action\n\n## License\n\n[MIT © Simon Lepel](${link})\n`;

describe('getCopyrightYear', () => {
  it('finds the year', () => {
    expect(getCopyrightYear(license('2026'))).toBe('2026');
    expect(getCopyrightYear('no copyright')).toBeUndefined();
  });
});

describe('getLicenseLinkYears', () => {
  it('finds the linked years', () => {
    expect(getLicenseLinkYears(readme('https://simbo.mit-license.org/@2026'))).toEqual(['2026']);
    expect(getLicenseLinkYears(readme('https://simbo.mit-license.org/2025/'))).toEqual(['2025/']);
    expect(getLicenseLinkYears('no link')).toEqual([]);
  });
});

describe('checkActionLicenses', () => {
  let directory: string;

  /**
   * Creates an action folder.
   *
   * @param name - The folder name.
   * @param files - The files of the action.
   */
  async function createAction(name: string, files: Record<string, string>): Promise<void> {
    await mkdir(join(directory, name));
    for (const [file, contents] of Object.entries(files)) {
      await writeFile(join(directory, name, file), contents);
    }
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'action-licenses-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('accepts matching license files and links', async () => {
    await createAction('good', {
      'package.json': '{}',
      'LICENSE.md': license('2026'),
      'README.md': readme('https://simbo.mit-license.org/@2026'),
    });
    await createAction('no-package', {});
    await writeFile(join(directory, 'file.txt'), 'not a folder');
    expect(await checkActionLicenses(directory)).toEqual([]);
  });

  it('reports all problems', async () => {
    await createAction('a-missing', { 'package.json': '{}' });
    await createAction('b-no-year', { 'package.json': '{}', 'LICENSE.md': 'MIT' });
    await createAction('c-no-link', { 'package.json': '{}', 'LICENSE.md': license('2026'), 'README.md': '# Action' });
    await createAction('d-wrong-year', {
      'package.json': '{}',
      'LICENSE.md': license('2026'),
      'README.md': readme('https://simbo.mit-license.org/2025/'),
    });
    await createAction('e-no-readme', { 'package.json': '{}', 'LICENSE.md': license('2027') });

    expect(await checkActionLicenses(directory)).toEqual([
      'a-missing: LICENSE.md is missing.',
      'b-no-year: LICENSE.md has no line "Copyright © <year> …".',
      'c-no-link: README.md does not link the license (https://simbo.mit-license.org/@2026).',
      'd-wrong-year: README.md links the license with "2025/" instead of "@2026".',
      'e-no-readme: README.md does not link the license (https://simbo.mit-license.org/@2027).',
    ]);
  });
});
