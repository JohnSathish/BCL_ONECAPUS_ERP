import {
  buildStateBreakdownFromLines,
  computeStateGross,
  computeStateNet,
  finalizeStatePayslipTotals,
} from './state-payroll-formulas';

describe('state-payroll-formulas', () => {
  it('computes Stephen T Sangma net per May 2026 State Scale sheet', () => {
    const gross = computeStateGross(51700, 5170, 26367, 500, 7755, 1000);
    expect(gross).toBe(92492);

    const net = computeStateNet(gross, 10340, 0, 0);
    expect(net).toBe(82152);
  });

  it('builds breakdown from payslip lines', () => {
    const breakdown = buildStateBreakdownFromLines([
      { componentCode: 'BASIC', componentType: 'EARNING', amount: 51700 },
      { componentCode: 'CPF_EMPLOYER', componentType: 'EARNING', amount: 5170 },
      { componentCode: 'DA', componentType: 'EARNING', amount: 26367 },
      { componentCode: 'HCA', componentType: 'EARNING', amount: 500 },
      { componentCode: 'HRA', componentType: 'EARNING', amount: 7755 },
      { componentCode: 'MA', componentType: 'EARNING', amount: 1000 },
      { componentCode: 'CPF', componentType: 'DEDUCTION', amount: 10340 },
    ]);

    expect(breakdown.gross).toBe(92492);
    expect(breakdown.net).toBe(82152);
  });

  it('finalizeStatePayslipTotals excludes professional tax', () => {
    const totals = finalizeStatePayslipTotals([
      { code: 'BASIC', name: 'Basic', componentType: 'EARNING', amount: 20200 },
      {
        code: 'CPF_EMPLOYER',
        name: 'CPF Employer',
        componentType: 'EARNING',
        amount: 1616,
      },
      { code: 'DA', name: 'DA', componentType: 'EARNING', amount: 10302 },
      { code: 'HCA', name: 'HCA', componentType: 'EARNING', amount: 500 },
      { code: 'HRA', name: 'HR', componentType: 'EARNING', amount: 3030 },
      { code: 'MA', name: 'MA', componentType: 'EARNING', amount: 1000 },
      { code: 'CPF', name: 'CPF', componentType: 'DEDUCTION', amount: 3232 },
      { code: 'LOAN', name: 'Loan', componentType: 'DEDUCTION', amount: 4000 },
      {
        code: 'PROFESSIONAL_TAX',
        name: 'Professional Tax',
        componentType: 'DEDUCTION',
        amount: 208,
      },
    ]);

    expect(totals.gross).toBe(36648);
    expect(totals.deductions).toBe(7232);
    expect(totals.net).toBe(29416);
  });
});
