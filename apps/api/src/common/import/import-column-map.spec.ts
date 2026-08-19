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

  it('maps Sem 7 lateral entry headers', () => {
    expect(normalizeHeader('Aggregate % Through Sem 6')).toBe(
      'aggregatePercentageThroughSem6',
    );
    expect(normalizeHeader('Previous College')).toBe('previousCollegeName');
    expect(normalizeHeader('Admission Type')).toBe('admissionType');
  });

  it('maps college and NEHU roll headers from office registers', () => {
    expect(normalizeHeader('Roll No.')).toBe('rollNumber');
    expect(normalizeHeader('College Roll No')).toBe('rollNumber');
    expect(normalizeHeader('NEHU ROLL NO.')).toBe('universityRollNumber');
    expect(normalizeHeader('NEHU ROLL')).toBe('universityRollNumber');
    expect(normalizeHeader('Board Roll Number')).toBe('boardRollNumber');
    expect(normalizeHeader('Regd. No.')).toBe('universityRegistrationNumber');
  });
});
