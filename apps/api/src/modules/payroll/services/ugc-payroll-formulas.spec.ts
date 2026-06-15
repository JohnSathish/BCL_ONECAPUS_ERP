import {
  buildUgcBreakdownFromLines,
  computeUgcGross,
  computeUgcNet,
  finalizeUgcPayslipTotals,
} from './ugc-payroll-formulas';

describe('ugc-payroll-formulas', () => {
  const braveWellLines = [
    { componentCode: 'BASIC', componentType: 'EARNING', amount: 70900 },
    { componentCode: 'DA', componentType: 'EARNING', amount: 41122 },
    { componentCode: 'CPF_EMPLOYER', componentType: 'EARNING', amount: 5672 },
    { componentCode: 'CPF', componentType: 'DEDUCTION', amount: 11344 },
    { componentCode: 'HOUSE_RENT', componentType: 'DEDUCTION', amount: 6500 },
    { componentCode: 'LOAN', componentType: 'DEDUCTION', amount: 0 },
    { componentCode: 'TDS', componentType: 'DEDUCTION', amount: 0 },
  ];

  it('computes Brave Well Mawthoh net per DBC Excel sheet', () => {
    const gross = computeUgcGross(70900, 41122, 5672);
    expect(gross).toBe(117694);

    const net = computeUgcNet(gross, 11344, 6500, 0, 0);
    expect(net).toBe(99850);
  });

  it('excludes professional tax from UGC net even when stored net is lower', () => {
    const lines = [
      ...braveWellLines,
      {
        componentCode: 'PROFESSIONAL_TAX',
        componentName: 'Professional Tax',
        componentType: 'DEDUCTION',
        amount: 208,
      },
    ];
    const breakdown = buildUgcBreakdownFromLines(lines, undefined, 99642);

    expect(breakdown.net).toBe(99850);
    expect(breakdown.excludedDeductions).toHaveLength(1);
    expect(breakdown.formulaMismatch).toBe(true);
    expect(breakdown.formulaMismatchAmount).toBe(-208);
  });

  it('finalizeUgcPayslipTotals ignores hidden deductions', () => {
    const totals = finalizeUgcPayslipTotals([
      { code: 'BASIC', name: 'Basic', componentType: 'EARNING', amount: 70900 },
      { code: 'DA', name: 'DA', componentType: 'EARNING', amount: 41122 },
      {
        code: 'CPF_EMPLOYER',
        name: 'CPF Employer',
        componentType: 'EARNING',
        amount: 5672,
      },
      { code: 'CPF', name: 'CPF', componentType: 'DEDUCTION', amount: 11344 },
      {
        code: 'HOUSE_RENT',
        name: 'House Rent',
        componentType: 'DEDUCTION',
        amount: 6500,
      },
      {
        code: 'PROFESSIONAL_TAX',
        name: 'Professional Tax',
        componentType: 'DEDUCTION',
        amount: 208,
      },
    ]);

    expect(totals.gross).toBe(117694);
    expect(totals.deductions).toBe(17844);
    expect(totals.net).toBe(99850);
    expect(totals.excluded).toHaveLength(1);
  });
});
