import {
  buildClass12SubjectCode,
  class12BoardLookupAliases,
  class12StreamLookupAliases,
  isExcelImportedStudent,
  normalizeClass12Stream,
} from './class12-subjects.util';

describe('class12 board/stream aliases', () => {
  it('expands MBOSE (MBOSE) into lookup keys', () => {
    expect(class12BoardLookupAliases('MBOSE (MBOSE)')).toEqual(
      expect.arrayContaining(['MBOSE (MBOSE)', 'MBOSE']),
    );
  });

  it('maps the Others board to OTHERS without changing MBOSE', () => {
    expect(class12BoardLookupAliases('Others')).toEqual(
      expect.arrayContaining(['OTHERS']),
    );
    expect(class12BoardLookupAliases('MBOSE')).not.toContain('OTHERS');
    expect(class12BoardLookupAliases('CBSE')).not.toContain('OTHERS');
  });

  it('keeps the MBOSE Arts Computer Science code separate from Science', () => {
    expect(buildClass12SubjectCode('MBOSE', 'ARTS', 'CS')).toBe(
      'MBOSE_ARTS_CS',
    );
    expect(
      buildClass12SubjectCode('MBOSE', 'SCIENCE', 'Computer Science'),
    ).toBe('MBOSE_SCIENCE_COMPUTER_SCIENCE');
  });

  it('maps Commerce stream to COMMERCE plus COM', () => {
    expect(normalizeClass12Stream('Commerce')).toBe('COMMERCE');
    expect(class12StreamLookupAliases('Commerce')).toEqual(
      expect.arrayContaining(['COMMERCE', 'COM']),
    );
  });
});

describe('isExcelImportedStudent', () => {
  it('treats Excel import rows as imported', () => {
    expect(isExcelImportedStudent({ importSource: 'IMPORT' })).toBe(true);
    expect(isExcelImportedStudent({ admissionSource: 'EXCEL' })).toBe(true);
  });

  it('keeps software admissions on the strict Class XII catalog', () => {
    expect(
      isExcelImportedStudent({
        admissionSource: 'ONLINE_ADMISSION',
        importSource: null,
      }),
    ).toBe(false);
    expect(
      isExcelImportedStudent({
        admissionSource: 'MANUAL',
        importSource: null,
      }),
    ).toBe(false);
  });
});
