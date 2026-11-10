import { describe, expect, it } from 'vitest';

import { parseCommitMessage } from './parse-commit-message.js';

describe('parseCommitMessage', () => {
  it('uses a single line as headline', () => {
    expect(parseCommitMessage('feat: add something')).toEqual({ headline: 'feat: add something' });
  });

  it('splits headline and body', () => {
    expect(parseCommitMessage('feat: add something\n\nMore details.\nSecond line.')).toEqual({
      headline: 'feat: add something',
      body: 'More details.\nSecond line.',
    });
  });

  it('trims surrounding whitespace and handles CRLF', () => {
    expect(parseCommitMessage('  \n fix: headline  \r\n\r\n body \r\n')).toEqual({
      headline: 'fix: headline',
      body: 'body',
    });
  });

  it('throws on an empty message', () => {
    expect(() => parseCommitMessage(' \n ')).toThrow('must not be empty');
  });
});
