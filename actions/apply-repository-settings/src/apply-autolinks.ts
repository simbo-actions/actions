import type { Autolink } from './apply-repository-settings.types.js';
import type { SettingsClient } from './settings-client.js';

/**
 * An autolink as returned by the GitHub API.
 */
interface CurrentAutolink extends Required<Autolink> {
  id: number;
}

/**
 * Creates the configured autolinks, matched by key prefix (ignoring case).
 * An autolink cannot be updated, so a changed one is deleted and created
 * again. With `prune`, deletes all other autolinks.
 *
 * @param client - The settings client.
 * @param autolinks - The configured autolinks.
 * @param prune - Whether to delete autolinks that are not configured.
 */
export async function applyAutolinks(client: SettingsClient, autolinks: Autolink[], prune: boolean): Promise<void> {
  const existing = await client.read<CurrentAutolink[]>('GET /repos/{owner}/{repo}/autolinks');
  const kept = new Set<CurrentAutolink>();

  for (const autolink of autolinks) {
    const expected = { ...autolink, is_alphanumeric: autolink.is_alphanumeric ?? true };
    const setting = `autolink "${autolink.key_prefix}"`;
    const current = existing.find(item => item.key_prefix.toLowerCase() === autolink.key_prefix.toLowerCase());
    if (current) {
      kept.add(current);
      if (current.url_template === expected.url_template && current.is_alphanumeric === expected.is_alphanumeric) {
        continue;
      }
      client.record({ setting, change: 'replace' });
      await client.write('DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}', { autolink_id: current.id });
    } else {
      client.record({ setting, change: 'create' });
    }
    await client.write('POST /repos/{owner}/{repo}/autolinks', expected);
  }

  if (!prune) {
    return;
  }
  const unconfigured = existing.filter(item => !kept.has(item));
  for (const autolink of unconfigured) {
    client.record({ setting: `autolink "${autolink.key_prefix}"`, change: 'delete' });
    await client.write('DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}', { autolink_id: autolink.id });
  }
}
