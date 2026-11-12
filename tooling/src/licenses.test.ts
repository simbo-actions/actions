import { describe, expect, it } from 'vitest';

import { ALLOWED_LICENSES } from './constants.ts';
import { findLicenseViolations, isLicenseAllowed } from './licenses.ts';

describe('isLicenseAllowed', () => {
  it.each(['MIT', 'ISC', 'Apache-2.0', '(MIT OR GPL-3.0)', 'MIT AND ISC', '(BSD-3-Clause OR MIT)'])(
    'allows %s',
    license => {
      expect(isLicenseAllowed(license, ALLOWED_LICENSES)).toBe(true);
    },
  );

  it.each(['GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'MIT AND GPL-3.0', 'UNLICENSED', 'Unknown', ''])(
    'rejects %s',
    license => {
      expect(isLicenseAllowed(license, ALLOWED_LICENSES)).toBe(false);
    },
  );
});

describe('findLicenseViolations', () => {
  it('returns packages with licenses that are not allowed, sorted', () => {
    expect(
      findLicenseViolations(
        {
          MIT: [{ name: 'ok', versions: ['1.0.0'] }],
          'GPL-3.0': [
            { name: 'z-copyleft', versions: ['2.0.0'] },
            { name: 'a-copyleft', versions: ['1.0.0', '1.1.0'] },
          ],
        },
        ALLOWED_LICENSES,
      ),
    ).toEqual([
      { name: 'a-copyleft', versions: ['1.0.0', '1.1.0'], license: 'GPL-3.0' },
      { name: 'z-copyleft', versions: ['2.0.0'], license: 'GPL-3.0' },
    ]);
  });

  it('returns nothing if all licenses are allowed', () => {
    expect(findLicenseViolations({ MIT: [{ name: 'ok', versions: ['1.0.0'] }] }, ALLOWED_LICENSES)).toEqual([]);
  });
});
