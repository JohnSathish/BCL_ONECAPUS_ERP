import { mapRowHeaders, normalizeHeader } from './import-column-map';

describe('import-column-map', () => {
  it('normalizes course code header', () => {
    expect(normalizeHeader('Course Code')).toBe('courseCode');
  });

  it('maps row values to keys', () => {
    const row = mapRowHeaders(
      ['Course Code', 'Delivery Type'],
      ['ENG-100', 'THEORY'],
    );
    expect(row.courseCode).toBe('ENG-100');
    expect(row.deliveryType).toBe('THEORY');
  });

  it('maps Sem 1 admission Excel headers', () => {
    expect(normalizeHeader('Application Number')).toBe('applicationNumber');
    expect(normalizeHeader('MDC Choice')).toBe('mdcSubject');
    expect(normalizeHeader('Address in Tura')).toBe('turaLine1');
    expect(normalizeHeader('Board Roll Number')).toBe('boardRollNumber');
  });
});
