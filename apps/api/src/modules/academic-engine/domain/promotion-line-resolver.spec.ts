import { priorLineSlotKey } from './promotion-line-resolver';

describe('promotion-line-resolver', () => {
  it('builds major slot keys with paper index', () => {
    expect(priorLineSlotKey('MAJOR', 2)).toBe('MAJOR-2');
    expect(priorLineSlotKey('MDC', null)).toBe('MDC');
  });
});
