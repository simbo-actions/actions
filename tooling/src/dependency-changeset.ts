/**
 * Determines which actions are affected by a dependency update.
 *
 * An action is affected if its `package.json` changed. If no action's
 * `package.json` changed but the lockfile did (an update of an indirect
 * dependency), all actions are affected, because their bundles may contain it.
 *
 * @param changedFiles - The files changed by the update, relative to the repository root.
 * @param actionFolders - The folder names of all actions in `actions/`.
 * @returns The affected action folders, sorted.
 */
export function getAffectedActions(changedFiles: readonly string[], actionFolders: readonly string[]): string[] {
  const changed = new Set(changedFiles);
  const affected = actionFolders.filter(folder => changed.has(`actions/${folder}/package.json`));
  const result = affected.length === 0 && changed.has('pnpm-lock.yaml') ? actionFolders : affected;
  return result.toSorted((a, b) => a.localeCompare(b));
}

/**
 * Formats a changeset with a patch release for packages.
 *
 * @param packageNames - The package names.
 * @returns The changeset file contents.
 */
export function formatDependencyChangeset(packageNames: readonly string[]): string {
  const releases = packageNames.map(name => `'${name}': patch`).join('\n');
  return `---\n${releases}\n---\n\nUpdate dependencies.\n`;
}
