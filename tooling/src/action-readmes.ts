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
  "About Simbo's Actions",
  'License',
];

/**
 * The heading of the section about the organization, shared by every action
 * README; its text is the template `tooling/about-section.md`.
 */
export const ABOUT_HEADING = "## About Simbo's Actions";

/**
 * The entry for the section about the organization in the contents of every
 * action README.
 */
export const ABOUT_CONTENTS_ENTRY = "- [About Simbo's Actions](#about-simbos-actions)";

/**
 * Checks the README of an action: required sections, and the section about the
 * organization, identical to the template, last before "License" and listed in
 * the contents.
 *
 * @param name - The action name, for messages.
 * @param readme - The README text.
 * @param aboutSection - The template of the section about the organization.
 * @returns The problems found; empty if everything is correct.
 */
export function checkActionReadme(name: string, readme: string, aboutSection: string): string[] {
  const problems: string[] = [];
  const headings = new Set([...readme.matchAll(/^## (.+)$/gm)].map(match => match[1].trim()));

  const missing = REQUIRED_README_SECTIONS.filter(section => !headings.has(section));
  if (missing.length > 0) {
    problems.push(`${name}: README.md is missing the section(s): ${missing.join(', ')}.`);
  }

  const start = readme.indexOf(`${ABOUT_HEADING}\n`);
  const end = readme.indexOf('\n## License\n', start);
  if (start !== -1 && (end === -1 || readme.slice(start, end).trim() !== aboutSection.trim())) {
    problems.push(`${name}: README.md must contain tooling/about-section.md unchanged, directly before "License".`);
  }

  if (!readme.includes(`\n${ABOUT_CONTENTS_ENTRY}\n`)) {
    problems.push(`${name}: README.md must list "${ABOUT_CONTENTS_ENTRY}" in its contents.`);
  }

  return problems;
}
