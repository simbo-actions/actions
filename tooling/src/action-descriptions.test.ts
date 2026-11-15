import { describe, expect, it } from 'vitest';

import { checkActionDescription, MAX_DESCRIPTION_LENGTH, readActionDescription } from './action-descriptions.ts';

const description = 'A GitHub Action to do one thing well.';
const actionYml = `name: Example\ndescription: ${description}\nruns:\n  using: node24\n`;
const readme = `# Example _(GitHub Action)_\n\nA GitHub Action to do one\nthing well.\n\nMore text.\n`;

describe('readActionDescription', () => {
  it('reads an unquoted description', () => {
    expect(readActionDescription(actionYml)).toBe(description);
  });

  it('reads a quoted description', () => {
    expect(readActionDescription(`description: "${description}"\n`)).toBe(description);
    expect(readActionDescription(`description: '${description}'\n`)).toBe(description);
  });

  it('returns undefined without a single-line description', () => {
    expect(readActionDescription('name: Example\n')).toBeUndefined();
    expect(readActionDescription('description: >\n  text\n')).toBeUndefined();
  });
});

describe('checkActionDescription', () => {
  it('accepts a matching description', () => {
    expect(checkActionDescription('example', actionYml, description, readme)).toEqual([]);
  });

  it('ignores links, code spans, and line breaks in the README', () => {
    const formatted = '# Example\n\nA GitHub Action to do `one`  \nthing [well](https://example.com).\n';
    expect(checkActionDescription('example', actionYml, description, formatted)).toEqual([]);
  });

  it('reports a missing description', () => {
    expect(checkActionDescription('example', 'name: Example\n', description, readme)).toEqual([
      'example: action.yml needs a description on a single line.',
    ]);
  });

  it('reports a description that is too long for the Marketplace', () => {
    const long = 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    const problems = checkActionDescription('example', `description: ${long}\n`, long, `# Example\n\n${long}\n`);
    expect(problems).toEqual([
      `example: the description in action.yml has ${MAX_DESCRIPTION_LENGTH + 1} characters; the GitHub Marketplace allows at most ${MAX_DESCRIPTION_LENGTH}.`,
    ]);
  });

  it('reports a different description in package.json and README.md', () => {
    expect(checkActionDescription('example', actionYml, 'Other.', '# Example\n\nOther.\n')).toEqual([
      'example: the description in package.json must match the one in action.yml.',
      'example: the first paragraph of README.md must be the description of action.yml.',
    ]);
  });
});
