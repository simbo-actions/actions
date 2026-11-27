import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reads a text file if it exists.
 *
 * @param path - The file path.
 * @returns The contents, or `undefined` if the file cannot be read.
 */
async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return;
  }
}

/**
 * Finds the copyright year in a license text.
 *
 * @param license - The license text.
 * @returns The year, or `undefined` if no copyright line is found.
 */
export function getCopyrightYear(license: string): string | undefined {
  return /^Copyright © (\d{4}) /m.exec(license)?.[1];
}

/**
 * Finds the years of all `mit-license.org` links in a README.
 *
 * @param readme - The README text.
 * @returns The linked years, for example `['2026']`, or the full path for links without `@<year>`.
 */
export function getLicenseLinkYears(readme: string): string[] {
  return [...readme.matchAll(/https?:\/\/[\w-]+\.mit-license\.org\/?([^\s)]*)/g)].map(match =>
    match[1].replace(/^@/, ''),
  );
}

/**
 * Checks the license files of one action folder.
 *
 * @param directory - The folder of the action.
 * @param name - The name of the action, for the messages.
 * @returns The problems found; empty if everything is correct or the folder is no package.
 */
async function checkActionLicense(directory: string, name: string): Promise<string[]> {
  const [packageJson, license, readme = ''] = await Promise.all(
    ['package.json', 'LICENSE.md', 'README.md'].map(async file => readOptional(join(directory, file))),
  );
  if (packageJson === undefined) {
    return [];
  }
  if (license === undefined) {
    return [`${name}: LICENSE.md is missing.`];
  }
  const year = getCopyrightYear(license);
  if (!year) {
    return [`${name}: LICENSE.md has no line "Copyright © <year> …".`];
  }
  const problems: string[] = [];
  const linkYears = getLicenseLinkYears(readme);
  if (linkYears.length === 0) {
    problems.push(`${name}: README.md does not link the license (https://simbo.mit-license.org/@${year}).`);
  }
  const wrongYears = linkYears.filter(linked => linked !== year);
  for (const linkYear of wrongYears) {
    problems.push(`${name}: README.md links the license with "${linkYear}" instead of "@${year}".`);
  }
  return problems;
}

/**
 * Checks the license files of all actions in a directory.
 * Every action must have a `LICENSE.md` with a copyright year, and its README
 * must link the license with the same year (`https://<user>.mit-license.org/@<year>`).
 *
 * @param actionsDirectory - The directory with one folder per action.
 * @returns The problems found, sorted by action; empty if everything is correct.
 */
export async function checkActionLicenses(actionsDirectory: string): Promise<string[]> {
  const entries = await readdir(actionsDirectory, { withFileTypes: true });
  const directories = entries.filter(item => item.isDirectory()).toSorted((a, b) => a.name.localeCompare(b.name));
  const problems = await Promise.all(
    directories.map(async ({ name }) => checkActionLicense(join(actionsDirectory, name), name)),
  );
  return problems.flat();
}
