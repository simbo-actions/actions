import { describe, expect, it } from 'vitest';

import { parseYaml } from './parse-yaml.js';

describe('parseYaml', () => {
  it('parses YAML with comments', () => {
    expect(parseYaml('# Settings\nrepository:\n  has_issues: false # off\ntopics: [a, b]\n')).toEqual({
      repository: { has_issues: false },
      topics: ['a', 'b'],
    });
  });

  it('parses JSON', () => {
    expect(parseYaml('{"a": [1, {"b": null}]}')).toEqual({ a: [1, { b: null }] });
  });

  it.each([
    [
      'invalid YAML',
      'a: [1,',
      'Invalid configuration: Flow sequence in block collection must be sufficiently indented',
    ],
    ['duplicate keys', 'a: 1\na: 2', 'Invalid configuration: Map keys must be unique at line 2, column 1:'],
    ['multiple documents', 'a: 1\n---\nb: 2', 'Invalid configuration: Source contains multiple documents'],
    ['aliases', 'a: &x 1\nb: *x', 'Invalid configuration: anchors are not allowed (&x).'],
    ['anchors', 'a: &x 1', 'anchors are not allowed (&x)'],
    ['custom tags', 'a: !secret 1', 'Unresolved tag: !secret'],
    ['standard tags', 'a: !!str 1', 'tags are not allowed (tag:yaml.org,2002:str).'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseYaml(text)).toThrow(message);
  });

  it('rejects an alias without an anchor', () => {
    expect(() => parseYaml('a: *x')).toThrow('Invalid configuration: aliases are not allowed (*x).');
  });
});
