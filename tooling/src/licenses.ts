/**
 * A package as listed by `pnpm licenses list --json`.
 */
interface LicensedPackage {
  name: string;
  versions: string[];
}

/**
 * The output of `pnpm licenses list --json`, grouped by license.
 */
export type LicenseList = Record<string, LicensedPackage[]>;

/**
 * A package with a license that is not allowed.
 */
export interface LicenseViolation {
  name: string;
  versions: string[];
  license: string;
}

/**
 * Finds packages whose license is not allowed.
 * SPDX expressions with `OR` are allowed if one alternative is allowed;
 * expressions with `AND` only if all parts are allowed.
 *
 * @param list - The output of `pnpm licenses list --json`, grouped by license.
 * @param allowed - The allowed SPDX identifiers.
 * @returns The violations, sorted by package name.
 */
export function findLicenseViolations(list: LicenseList, allowed: readonly string[]): LicenseViolation[] {
  const violations: LicenseViolation[] = [];
  for (const [license, packages] of Object.entries(list)) {
    if (isLicenseAllowed(license, allowed)) {
      continue;
    }
    for (const { name, versions } of packages) {
      violations.push({ name, versions, license });
    }
  }
  return violations.toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Checks whether an SPDX license expression is allowed.
 *
 * @param expression - The SPDX expression, for example `MIT` or `(MIT OR GPL-3.0)`.
 * @param allowed - The allowed SPDX identifiers.
 * @returns `true` if the expression is allowed.
 */
export function isLicenseAllowed(expression: string, allowed: readonly string[]): boolean {
  const normalized = expression.replaceAll(/[()]/g, '').trim();
  return normalized
    .split(/\s+OR\s+/)
    .some(alternative => alternative.split(/\s+AND\s+/).every(part => allowed.includes(part.trim())));
}
