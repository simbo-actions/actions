/**
 * The maximum length of an action description: the GitHub Marketplace requires
 * fewer than 125 characters.
 */
export const MAX_DESCRIPTION_LENGTH = 124;

/**
 * Reads the description of an action from its `action.yml`: a single line,
 * unquoted or in single or double quotes.
 *
 * @param actionYml - The text of `action.yml`.
 * @returns The description, or `undefined` if there is none on a single line.
 */
export function readActionDescription(actionYml: string): string | undefined {
  const match = /^description:[ \t]*(.+)$/m.exec(actionYml);
  const value = match?.[1].trim();
  if (value === undefined || ['', '|', '>'].includes(value)) {
    return undefined;
  }
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

/**
 * Checks the description of an action: present in `action.yml` on a single
 * line, short enough for the GitHub Marketplace, identical in `package.json`,
 * and the first paragraph of the README, apart from links and code spans.
 *
 * @param name - The action name, for messages.
 * @param actionYml - The text of `action.yml`.
 * @param packageDescription - The description in `package.json`.
 * @param readme - The README text.
 * @returns The problems found; empty if everything is correct.
 */
export function checkActionDescription(
  name: string,
  actionYml: string,
  packageDescription: string | undefined,
  readme: string,
): string[] {
  const description = readActionDescription(actionYml);
  if (description === undefined) {
    return [`${name}: action.yml needs a description on a single line.`];
  }

  const problems: string[] = [];
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    problems.push(
      `${name}: the description in action.yml has ${description.length} characters; the GitHub Marketplace allows at most ${MAX_DESCRIPTION_LENGTH}.`,
    );
  }
  if (packageDescription !== description) {
    problems.push(`${name}: the description in package.json must match the one in action.yml.`);
  }
  // Links and code spans may format the paragraph; their text must match.
  const firstParagraph = readme
    .split(/\n\s*\n/, 2)[1]
    ?.replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll('`', '')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (firstParagraph !== description) {
    problems.push(`${name}: the first paragraph of README.md must be the description of action.yml.`);
  }
  return problems;
}
