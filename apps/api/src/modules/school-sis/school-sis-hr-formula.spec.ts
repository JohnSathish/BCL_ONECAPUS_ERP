import {
  evaluateFormulaPaise,
  paiseToRupees,
  rupeesToPaise,
} from './school-sis-hr-formula';

describe('HR salary formula engine', () => {
  it('computes HRA as 20% of basic without floating money', () => {
    const basic = rupeesToPaise(20000);
    const hra = evaluateFormulaPaise('BASIC * 0.20', { BASIC: basic });
    expect(hra).toBe(rupeesToPaise(4000));
    expect(paiseToRupees(hra)).toBe('4000.00');
  });

  it('supports GROSS - BASIC and LOP daily rate', () => {
    const gross = rupeesToPaise(30000);
    const lop = evaluateFormulaPaise('GROSS * LOP_DAYS / WORKING_DAYS', {
      GROSS: gross,
      WORKING_DAYS: 26n,
      LOP_DAYS: 2n,
    });
    expect(lop).toBe(230769n);
  });

  it('rejects unsafe expressions', () => {
    expect(() =>
      evaluateFormulaPaise('BASIC; process.exit(1)', { BASIC: 1n }),
    ).toThrow();
    expect(() => evaluateFormulaPaise('constructor', {})).toThrow();
  });
});
