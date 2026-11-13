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
 * Formats a patch changeset for dependency updates.
 *
 * @param packageNames - The package names of the affected actions.
 * @returns The changeset file content.
 */
export function formatDependencyChangeset(packageNames: readonly string[]): string {
  const releases = packageNames.map(name => `'${name}': patch`).join('\n');
  return `---\n${releases}\n---\n\nUpdate dependencies.\n`;
}
