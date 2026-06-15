import type { CycleSettings } from './admissions-cycle.service';

export const DEFAULT_APPLICATION_FEE_INR = 600;

export function resolveAdmissionFeeDue(
  settings?: CycleSettings | Record<string, unknown> | null,
) {
  const s = (settings ?? {}) as { admissionFeeMin?: number };
  const amount = Number(s.admissionFeeMin);
  return Number.isFinite(amount) && amount > 0 ? amount : 10500;
}

export function isAdmissionFeeApplicable(status?: string | null) {
  return status === 'allotted';
}
