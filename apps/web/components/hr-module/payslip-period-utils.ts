import type { PayslipListParams } from '@/types/payroll';

export type PeriodPreset = 'current' | '3m' | '6m' | '12m' | 'fy' | 'custom';

export function currentFinancialYearStart(ref = new Date()) {
  const m = ref.getMonth() + 1;
  const y = ref.getFullYear();
  return m >= 4 ? y : y - 1;
}

export function buildPeriodParams(
  preset: PeriodPreset,
  base: {
    month?: number;
    year?: number;
    staffProfileId?: string;
    departmentId?: string;
  },
  custom?: { fromMonth: number; fromYear: number; toMonth: number; toYear: number },
): PayslipListParams {
  const params: PayslipListParams = {
    staffProfileId: base.staffProfileId,
    departmentId: base.departmentId,
    periodPreset: preset,
  };

  if (preset === 'custom' && custom) {
    return {
      ...params,
      fromMonth: custom.fromMonth,
      fromYear: custom.fromYear,
      toMonth: custom.toMonth,
      toYear: custom.toYear,
    };
  }

  if (preset === 'fy') {
    return { ...params, financialYear: currentFinancialYearStart() };
  }

  if (preset === 'current') {
    return { ...params, month: base.month, year: base.year };
  }

  return {
    ...params,
    month: base.month,
    year: base.year,
    periodPreset: preset,
  };
}
