import { describe, expect, it } from 'vitest';

import { isExcelImportedStudent } from './student-admission-source';

describe('isExcelImportedStudent', () => {
  it('relaxes Class XII catalog for Excel import', () => {
    expect(isExcelImportedStudent({ importSource: 'IMPORT' })).toBe(true);
  });

  it('keeps software admissions strict', () => {
    expect(
      isExcelImportedStudent({
        admissionSource: 'ONLINE_ADMISSION',
        importSource: null,
      }),
    ).toBe(false);
  });
});
