import { describe, expect, it } from 'vitest';
import { institutionDateKey } from './institution-date';

describe('institutionDateKey', () => {
  it('uses the IST calendar date, not UTC', () => {
    // 20 Aug 2026 00:19 IST = 19 Aug 2026 18:49 UTC
    const justAfterMidnightIst = new Date('2026-08-19T18:49:00.000Z');
    expect(institutionDateKey(justAfterMidnightIst)).toBe('2026-08-20');
    expect(justAfterMidnightIst.toISOString().slice(0, 10)).toBe('2026-08-19');
  });
});
