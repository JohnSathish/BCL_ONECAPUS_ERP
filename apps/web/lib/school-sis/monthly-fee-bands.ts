export const JUNIOR_MONTHLY_FEE_CODES = ['NURSERY', 'LKG', 'UKG', 'I', 'II', 'III', 'IV'] as const;

export const MIDDLE_MONTHLY_FEE_CODES = ['V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

export const MONTHLY_FEE_CODES = [
  ...JUNIOR_MONTHLY_FEE_CODES,
  ...MIDDLE_MONTHLY_FEE_CODES,
] as const;

export function isMonthlyFeeGrade(code: string) {
  return (MONTHLY_FEE_CODES as readonly string[]).includes(code);
}

export function isMiddleMonthlyGrade(code: string) {
  return (MIDDLE_MONTHLY_FEE_CODES as readonly string[]).includes(code);
}

export function monthlyOtherLabel(code: string) {
  return isMiddleMonthlyGrade(code) ? 'Computer Fee' : 'Other Fee';
}
