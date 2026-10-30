import { fillUsageDays, usageRange } from './library-usage-days';

describe('library usage days', () => {
  it('keeps a zero for a day with no issues or returns', () => {
    const start = new Date(2026, 9, 23);
    const series = fillUsageDays(
      start,
      3,
      new Map([['2026-10-24', 2]]),
      new Map([['2026-10-23', 1]]),
    );
    expect(series.map((row) => row.issued)).toEqual([0, 2, 0]);
    expect(series.map((row) => row.returned)).toEqual([1, 0, 0]);
    expect(series[0]?.date).toBe('2026-10-23');
  });

  it('rejects a custom range longer than 92 days', () => {
    expect(() => usageRange({ from: '2026-01-01', to: '2026-06-01' })).toThrow(
      /92 days/,
    );
  });
});
