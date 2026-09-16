import {
  reportFileName,
  formatInr,
  DEFAULT_REPORT_DESIGN,
} from './report-types';

describe('school report engine formatters', () => {
  it('formats Indian rupees with the rupee sign', () => {
    expect(formatInr(3600)).toBe('₹3,600.00');
    expect(formatInr(2483160)).toMatch(/^₹/);
  });

  it('builds a professional download name', () => {
    const name = reportFileName(
      {
        ...DEFAULT_REPORT_DESIGN,
        logoDataUri: null,
        shortName: "St. Luke's",
      } as never,
      'Fee Collection Register',
      'pdf',
      'September 2026',
    );
    expect(name).toBe('St_Lukes_Fee_Collection_Register_September_2026.pdf');
  });
});
