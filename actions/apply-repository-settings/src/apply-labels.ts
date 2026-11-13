import type { Label } from './apply-repository-settings.types.js';
import type { SettingsClient } from './settings-client.js';

/**
 * A label as returned by the GitHub API.
 */
interface CurrentLabel {
  name: string;
  color: string;
  description: string | null;
}

/**
 * Lists what differs between a label and its configuration.
 *
 * @param label - The configured label.
 * @param current - The current label.
 * @returns The differences, for example `color d73a4a → 0e8a16`.
 */
function labelDifferences(label: Label, current: CurrentLabel): string[] {
  const differences: string[] = [];
  if (current.name !== label.name) {
    differences.push(`name "${current.name}" → "${label.name}"`);
  }
  if (current.color.toLowerCase() !== label.color) {
    differences.push(`color ${current.color} → ${label.color}`);
  }
  if (label.description !== undefined && (current.description ?? '') !== label.description) {
    differences.push('description');
  }
  return differences;
}

/**
 * Creates, updates, and renames the configured labels, matched by name
 * (ignoring case) or by `old_name`. With `prune`, deletes all other labels.
 *
 * @param client - The settings client.
 * @param labels - The configured labels.
 * @param prune - Whether to delete labels that are not configured.
 */
export async function applyLabels(client: SettingsClient, labels: Label[], prune: boolean): Promise<void> {
  const existing = await client.readAll<CurrentLabel>('GET /repos/{owner}/{repo}/labels');
  const find = (name: string): CurrentLabel | undefined =>
    existing.find(label => label.name.toLowerCase() === name.toLowerCase());
  const kept = new Set<CurrentLabel>();

  for (const label of labels) {
    const setting = `label "${label.name}"`;
    const current = find(label.name) ?? (label.old_name === undefined ? undefined : find(label.old_name));
    const body = { color: label.color, ...(label.description !== undefined && { description: label.description }) };
    if (!current) {
      client.record({ setting, change: 'create' });
      await client.write('POST /repos/{owner}/{repo}/labels', { name: label.name, ...body });
      continue;
    }
    kept.add(current);
    const differences = labelDifferences(label, current);
    if (differences.length === 0) {
      continue;
    }
    client.record({ setting, change: `update (${differences.join(', ')})` });
    await client.write('PATCH /repos/{owner}/{repo}/labels/{name}', {
      name: current.name,
      new_name: label.name,
      ...body,
    });
  }

  if (!prune) {
    return;
  }
  const unconfigured = existing.filter(item => !kept.has(item));
  for (const label of unconfigured) {
    client.record({ setting: `label "${label.name}"`, change: 'delete' });
    await client.write('DELETE /repos/{owner}/{repo}/labels/{name}', { name: label.name });
  }
}
