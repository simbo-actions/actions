import type { CustomPropertyValue } from './apply-repository-settings.types.js';
import type { SettingsClient } from './settings-client.js';

/**
 * Formats a property value for the comparison and the change log; lists are
 * compared without order, a missing value is `null`.
 *
 * @param value - The value.
 * @returns The value as JSON.
 */
function formatValue(value: CustomPropertyValue | undefined): string {
  if (value === undefined) {
    return 'null';
  }
  return JSON.stringify(Array.isArray(value) ? value.toSorted((a, b) => a.localeCompare(b)) : value);
}

/**
 * Sets the configured values of custom properties in one request; `null`
 * removes a value. The properties themselves are defined by the organization.
 *
 * @param client - The settings client.
 * @param properties - The configured values.
 */
export async function applyCustomProperties(
  client: SettingsClient,
  properties: Record<string, CustomPropertyValue>,
): Promise<void> {
  const current = await client.read<{ property_name: string; value: CustomPropertyValue }[]>(
    'GET /repos/{owner}/{repo}/properties/values',
  );
  const currentValue = (name: string): CustomPropertyValue | undefined =>
    current.find(({ property_name: key }) => key === name)?.value;
  const changed = Object.entries(properties).filter(
    ([name, value]) => formatValue(currentValue(name)) !== formatValue(value),
  );
  if (changed.length === 0) {
    return;
  }
  for (const [name, value] of changed) {
    client.record({
      setting: `custom_properties.${name}`,
      change: `${formatValue(currentValue(name))} → ${formatValue(value)}`,
    });
  }
  await client.write('PATCH /repos/{owner}/{repo}/properties/values', {
    properties: changed.map(([name, value]) => ({ property_name: name, value })),
  });
}
