import { parseFlexibleDate } from './parse-flexible-date';

describe('parseFlexibleDate', () => {
  it('accepts normal Indian DOB formats', () => {
    expect(parseFlexibleDate('23/05/2005')).toBe('2005-05-23');
    expect(parseFlexibleDate('2005-05-23')).toBe('2005-05-23');
    expect(parseFlexibleDate('23.05.2005')).toBe('2005-05-23');
  });

  it('rejects absurd future years that crash Prisma DateTime', () => {
    expect(parseFlexibleDate('20205-05-23')).toBeNull();
    expect(parseFlexibleDate('23/05/20205')).toBeNull();
    expect(parseFlexibleDate('+020205-05-23T00:00:00.000Z')).toBeNull();
  });

  it('rejects years before 1900', () => {
    expect(parseFlexibleDate('1899-12-31')).toBeNull();
  });
});
