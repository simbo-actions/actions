import { describe, expect, it } from 'vitest';

import { checkIdenticalCopies } from './identical-copies.ts';

describe('checkIdenticalCopies', () => {
  it('accepts identical copies', () => {
    expect(checkIdenticalCopies('a.ts', { 'x/a.ts': 'same', 'y/a.ts': 'same' })).toEqual([]);
  });

  it('reports copies that differ from the first one', () => {
    expect(checkIdenticalCopies('a.ts', { 'x/a.ts': 'same', 'y/a.ts': 'other', 'z/a.ts': 'same' })).toEqual([
      'y/a.ts: differs from x/a.ts; keep all copies of a.ts identical.',
    ]);
  });

  it('accepts no copies', () => {
    expect(checkIdenticalCopies('a.ts', {})).toEqual([]);
  });
});
