import type { BypassActor, Rule, Ruleset } from './apply-repository-settings.types.js';

/**
 * Checks whether all values of `expected` are present in `actual`, recursively.
 * Arrays must have the same items in the same order; additional object keys in
 * `actual` are ignored.
 *
 * @param expected - The expected value.
 * @param actual - The actual value.
 * @returns `true` if `actual` contains `expected`.
 */
export function matches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => matches(item, actual[index]))
    );
  }
  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) {
      return false;
    }
    const actualRecord = actual as Record<string, unknown>;
    return Object.entries(expected).every(([key, value]) => matches(value, actualRecord[key]));
  }
  return expected === actual;
}

/**
 * Checks whether a ruleset from the API matches the configured ruleset,
 * independent of the order of rules and bypass actors.
 *
 * @param expected - The configured ruleset.
 * @param actual - The ruleset from the API.
 * @returns `true` if the ruleset matches.
 */
export function rulesetMatches(expected: Ruleset, actual: Partial<Ruleset>): boolean {
  const byType = (items: Rule[]): Rule[] => items.toSorted((a, b) => a.type.localeCompare(b.type));
  const byActor = (items: BypassActor[]): BypassActor[] =>
    items.toSorted((a, b) =>
      `${a.actor_type}${String(a.actor_id)}`.localeCompare(`${b.actor_type}${String(b.actor_id)}`),
    );
  const { rules = [], bypass_actors: bypassActors = [], ...rest } = expected;
  return (
    matches(rest, actual) &&
    matches(byType(rules), byType(actual.rules ?? [])) &&
    matches(byActor(bypassActors), byActor(actual.bypass_actors ?? []))
  );
}
