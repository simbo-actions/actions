/**
 * Sections every action README must have, as required by STANDARDS.md.
 */
export const REQUIRED_README_SECTIONS: readonly string[] = [
  'How It Works',
  'Usage',
  'Examples',
  'Inputs',
  'Outputs',
  'Token and Permissions',
  'Security',
  'Limitations',
  'License',
];

/**
 * The link to the monorepo that the note on top of every action README contains.
 */
export const MONOREPO_URL = 'https://github.com/simbo-actions/actions';

/**
 * Checks the README of an action: required sections, and the note that the
 * action is developed in the monorepo and published automatically.
 *
 * @param name - The action name, for messages.
 * @param readme - The README text.
 * @returns The problems found; empty if everything is correct.
 */
export function checkActionReadme(name: string, readme: string): string[] {
  const problems: string[] = [];
  const headings = new Set([...readme.matchAll(/^## (.+)$/gm)].map(match => match[1].trim()));

  const missing = REQUIRED_README_SECTIONS.filter(section => !headings.has(section));
  if (missing.length > 0) {
    problems.push(`${name}: README.md is missing the section(s): ${missing.join(', ')}.`);
  }

  const intro = readme.split(/^## /m, 1)[0];
  if (!intro.includes(MONOREPO_URL) || !intro.includes('published here automatically')) {
    problems.push(`${name}: README.md has no note about the monorepo before the first section.`);
  }

  return problems;
}
