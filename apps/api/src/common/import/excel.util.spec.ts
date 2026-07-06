import {
  excelMinorByMajorOffsetFormula,
  excelQuotedSheetName,
} from './excel.util';

describe('excelMinorByMajorOffsetFormula', () => {
  it('quotes sheet names and uses row-relative major cell', () => {
    expect(excelQuotedSheetName('FA Sem5 Minors By Major')).toBe(
      "'FA Sem5 Minors By Major'",
    );
    expect(excelQuotedSheetName("Bob's Minors")).toBe("'Bob''s Minors'");

    const formula = excelMinorByMajorOffsetFormula(
      'FA Sem5 Minors By Major',
      'L',
    );
    expect(formula).toContain("'FA Sem5 Minors By Major'!$A:$A");
    expect(formula).toContain('$L3');
    expect(formula).not.toContain('$L$3');
    expect(formula).not.toContain('INDIRECT');
    expect(formula).not.toContain('definedName');
  });
});
