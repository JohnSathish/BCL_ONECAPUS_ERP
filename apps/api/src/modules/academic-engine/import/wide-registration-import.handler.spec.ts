import {
  isWideRegistrationFormat,
  resolveSemesterSequenceFromWideRow,
  unpivotWideRows,
} from './wide-registration-import.handler';

describe('wide-registration-import.handler', () => {
  it('detects wide format from category columns', () => {
    expect(
      isWideRegistrationFormat({
        sampleRaw: {
          registrationNumber: 'REG001',
          semester: 1,
          major: 'BCA-M101',
          mdc: 'MDC101',
        },
      }),
    ).toBe(true);
  });

  it('does not treat long format as wide', () => {
    expect(
      isWideRegistrationFormat({
        sampleRaw: {
          registrationNumber: 'REG001',
          category: 'MAJOR',
          courseCode: 'BCA-M101',
        },
      }),
    ).toBe(false);
  });

  it('unpivots wide rows including pipe-delimited major and Major-1/Major-2', () => {
    const rows = unpivotWideRows([
      {
        rowNumber: 2,
        raw: {
          registrationNumber: 'REG2026001',
          semester: 1,
          major: 'BCA-M101',
          minor: 'MAT-M101',
          mdc: 'MDC101',
        },
      },
      {
        rowNumber: 3,
        raw: {
          registrationNumber: 'REG2024001',
          semester: 5,
          major: 'BCA-M501|BCA-M502',
          mdc: 'MDC501',
        },
      },
      {
        rowNumber: 4,
        raw: {
          registrationNumber: 'REG2024002',
          semester: 5,
          'major-1': 'BCA-M501',
          'major-2': 'BCA-M502',
          aec: 'AEC-ENG3',
        },
      },
    ]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceRowNumber: 2,
          registrationNumber: 'REG2026001',
          semesterSequence: 1,
          category: 'MAJOR',
          courseCode: 'BCA-M101',
        }),
        expect.objectContaining({
          category: 'MINOR',
          courseCode: 'MAT-M101',
        }),
        expect.objectContaining({
          category: 'MDC',
          courseCode: 'MDC501',
          semesterSequence: 5,
        }),
        expect.objectContaining({
          registrationNumber: 'REG2024001',
          category: 'MAJOR',
          courseCode: 'BCA-M501',
          majorPaperIndex: 1,
        }),
        expect.objectContaining({
          registrationNumber: 'REG2024001',
          category: 'MAJOR',
          courseCode: 'BCA-M502',
          majorPaperIndex: 2,
        }),
        expect.objectContaining({
          registrationNumber: 'REG2024002',
          category: 'MAJOR',
          courseCode: 'BCA-M501',
          majorPaperIndex: 1,
        }),
        expect.objectContaining({
          registrationNumber: 'REG2024002',
          category: 'MAJOR',
          courseCode: 'BCA-M502',
          majorPaperIndex: 2,
        }),
        expect.objectContaining({
          registrationNumber: 'REG2024002',
          category: 'AEC',
          courseCode: 'AEC-ENG3',
        }),
      ]),
    );
  });

  it('resolves semester sequence from varied cell formats', () => {
    expect(resolveSemesterSequenceFromWideRow({ semester: 3 })).toBe(3);
    expect(resolveSemesterSequenceFromWideRow({ semester: 'Sem 5' })).toBe(5);
    expect(resolveSemesterSequenceFromWideRow({ semester: '' })).toBeNull();
  });
});
