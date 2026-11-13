import { isAlias, isNode, parseDocument, visit } from 'yaml';

/**
 * Parses a configuration file strictly: YAML 1.2, and therefore JSON, without
 * duplicate keys, anchors, aliases, or tags, so that every value is exactly
 * what the file shows.
 *
 * @param text - The contents of the file.
 * @returns The parsed data.
 * @throws {Error} if the file is not valid YAML or uses a feature that is not allowed.
 */
export function parseYaml(text: string): unknown {
  const document = parseDocument(text, { uniqueKeys: true, merge: false, prettyErrors: true });
  const problems = [...document.errors, ...document.warnings];
  if (problems.length > 0) {
    throw new Error(`Invalid configuration: ${problems[0].message.split('\n', 1)[0]}`);
  }
  visit(document, (_, node) => {
    if (isAlias(node)) {
      throw new Error(`Invalid configuration: aliases are not allowed (*${node.source}).`);
    }
    if (isNode(node) && node.anchor !== undefined) {
      throw new Error(`Invalid configuration: anchors are not allowed (&${node.anchor}).`);
    }
    if (isNode(node) && node.tag !== undefined) {
      throw new Error(`Invalid configuration: tags are not allowed (${node.tag}).`);
    }
  });
  return document.toJS() as unknown;
}
