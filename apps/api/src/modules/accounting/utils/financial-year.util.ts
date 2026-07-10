export type PeriodBounds = { startDate: Date; endDate: Date };

export function financialYearLabel(startYear: number): string {
  const end = startYear + 1;
  return `${startYear}-${String(end).slice(-2)}`;
}

export function currentFinancialYearStart(ref = new Date()): number {
  const year = ref.getFullYear();
  return ref.getMonth() >= 3 ? year : year - 1;
}

export function financialYearBounds(startYear: number): PeriodBounds {
  return {
    startDate: new Date(Date.UTC(startYear, 3, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 2, 31)),
  };
}

export function formatVoucherNo(
  prefix: string,
  fyLabel: string,
  sequenceNo: number,
): string {
  return `${prefix}/${fyLabel}/${String(sequenceNo).padStart(4, '0')}`;
}
