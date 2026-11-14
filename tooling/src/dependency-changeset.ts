/**
 * A package in a dependency tree as printed by `pnpm list --json`.
 */
export interface DependencyNode {
  version?: string;
  dependencies?: DependencyTree;
}

/**
 * A dependency tree as printed by `pnpm list --json`, by package name.
 */
export type DependencyTree = Record<string, DependencyNode | undefined>;

/**
 * Flattens a dependency tree into its packages.
 *
 * @param tree - The dependencies of a project, as printed by `pnpm list --json`.
 * @returns Every package as `name@version`, unique and sorted.
 */
export function flattenDependencies(tree: DependencyTree | undefined): string[] {
  const packages = new Set<string>();
  const visit = (dependencies: DependencyTree | undefined): void => {
    if (!dependencies) {
      return;
    }
    const items = Object.entries(dependencies);
    for (const [name, dependency] of items) {
      packages.add(`${name}@${dependency?.version ?? ''}`);
      visit(dependency?.dependencies);
    }
  };
  visit(tree);
  return [...packages].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Determines the actions whose bundled (production) dependencies changed.
 *
 * @param before - The production packages of every action before the update.
 * @param after - The production packages of every action after the update.
 * @returns The names of the affected actions, sorted.
 */
export function getAffectedActions(before: Record<string, string[]>, after: Record<string, string[]>): string[] {
  return Object.keys(after)
    .filter(name => JSON.stringify(before[name] ?? []) !== JSON.stringify(after[name]))
    .toSorted((a, b) => a.localeCompare(b));
}

/**
 * The dependencies of a `package.json`.
 */
export interface PackageDependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * An updated direct dependency.
 */
export interface DependencyUpdate {
  name: string;

  /**
   * The new version range, for example `^2.9.1`.
   */
  range: string;
}

/**
 * Lists the direct dependencies whose version range changed or that were
 * added.
 *
 * @param before - The dependencies before the update.
 * @param after - The dependencies after the update.
 * @returns The updates, sorted by name.
 */
export function diffDependencies(
  before: Record<string, string> | undefined,
  after: Record<string, string> | undefined,
): DependencyUpdate[] {
  return Object.entries(after ?? {})
    .filter(([name, range]) => before?.[name] !== range)
    .map(([name, range]) => ({ name, range }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Merges lists of updates into one, without duplicates.
 *
 * @param lists - The lists of updates.
 * @returns The unique updates, sorted by name.
 */
export function mergeUpdates(...lists: DependencyUpdate[][]): DependencyUpdate[] {
  const unique = new Map(lists.flat().map(update => [`${update.name}@${update.range}`, update]));
  return [...unique.values()].toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Formats a patch changeset for dependency updates, as described in
 * DEVELOPMENT.md: one sentence for a single update, a summary with a list for
 * several.
 *
 * @param packageNames - The packages to release.
 * @param updates - The updated dependencies; empty if only the lockfile changed.
 * @param summary - The summary for several updates, for example `Update dependencies.`.
 * @returns The changeset file content.
 */
export function formatDependencyChangeset(
  packageNames: readonly string[],
  updates: readonly DependencyUpdate[],
  summary: string,
): string {
  const releases = packageNames.map(name => `'${name}': patch`).join('\n');
  let body: string;
  if (updates.length === 0) {
    body = 'Update the bundled dependencies in `pnpm-lock.yaml`.\n';
  } else if (updates.length === 1) {
    body = `Update \`${updates[0].name}\` to ${updates[0].range}.\n`;
  } else {
    body = `${summary}\n\n${updates.map(({ name, range }) => `- \`${name}\` to ${range}`).join('\n')}\n`;
  }
  return `---\n${releases}\n---\n\n${body}`;
}
