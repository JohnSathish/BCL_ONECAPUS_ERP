import type { CourseDeliveryType, CreditCalculationMode } from '@/constants/course-delivery';
import { getDeliveryProfile, isManualCreditDelivery } from '@/constants/course-delivery';

export type CourseAcademicFormValues = {
  deliveryType?: CourseDeliveryType;
  creditCalculationMode?: CreditCalculationMode;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  theoryHoursPerWeek: number;
  practicalHoursPerWeek: number;
  totalTheoryContactHours: number;
  totalPracticalContactHours: number;
  totalContactHours: number;
};

export function resolveCreditCalculationMode(
  deliveryType?: CourseDeliveryType,
  explicit?: CreditCalculationMode,
): CreditCalculationMode {
  if (explicit) return explicit;
  if (deliveryType) return getDeliveryProfile(deliveryType).creditCalculationMode;
  return 'AUTO_CALCULATED';
}

export function validateCourseAcademicForm(
  values: CourseAcademicFormValues,
): Partial<Record<keyof CourseAcademicFormValues, string>> {
  const errors: Partial<Record<keyof CourseAcademicFormValues, string>> = {};
  const deliveryType = values.deliveryType ?? 'THEORY';
  const profile = getDeliveryProfile(deliveryType);
  const mode = resolveCreditCalculationMode(deliveryType, values.creditCalculationMode);

  const theoryCredits = Math.max(0, values.theoryCredits || 0);
  const practicalCredits = Math.max(0, values.practicalCredits || 0);
  const credits = Math.max(0, values.credits || 0);
  const theoryWeekly = Math.max(0, values.theoryHoursPerWeek || 0);
  const practicalWeekly = Math.max(0, values.practicalHoursPerWeek || 0);
  const theoryContact = Math.max(0, values.totalTheoryContactHours || 0);
  const practicalContact = Math.max(0, values.totalPracticalContactHours || 0);
  const totalContact = Math.max(0, values.totalContactHours || 0);

  if (mode === 'MANUAL_OVERRIDE') {
    if (credits <= 0) {
      errors.credits = 'Total credits must be greater than zero';
    }
    if (totalContact <= 0) {
      errors.totalContactHours = 'Total contact hours must be greater than zero';
    }
    if (theoryCredits === 0 && theoryWeekly > 0) {
      errors.theoryHoursPerWeek = 'Weekly theory hours must be 0 when theory credits are 0';
    }
    if (practicalCredits === 0 && practicalWeekly > 0) {
      errors.practicalHoursPerWeek =
        'Weekly practical hours must be 0 when practical credits are 0';
    }
    return errors;
  }

  if (deliveryType === 'THEORY' && theoryCredits <= 0) {
    errors.theoryCredits = 'Theory credits are required for a theory course';
    return errors;
  }

  if (deliveryType === 'PRACTICAL' && practicalCredits <= 0) {
    errors.practicalCredits = 'Practical credits are required for a practical course';
    return errors;
  }

  if (theoryCredits + practicalCredits <= 0) {
    errors.theoryCredits = 'At least one of theory or practical credits must be set';
    return errors;
  }

  if (theoryCredits === 0 && theoryWeekly > 0) {
    errors.theoryHoursPerWeek = 'Weekly theory hours must be 0 when theory credits are 0';
  }
  if (practicalCredits === 0 && practicalWeekly > 0) {
    errors.practicalHoursPerWeek = 'Weekly practical hours must be 0 when practical credits are 0';
  }
  if (theoryCredits === 0 && theoryContact > 0) {
    errors.totalTheoryContactHours = 'Theory contact hours must be 0 when theory credits are 0';
  }
  if (practicalCredits === 0 && practicalContact > 0) {
    errors.totalPracticalContactHours =
      'Practical contact hours must be 0 when practical credits are 0';
  }

  if (theoryCredits > 0 && theoryContact <= 0) {
    errors.totalTheoryContactHours = 'Set theory contact hours when theory credits are set';
  }
  if (practicalCredits > 0 && practicalContact <= 0) {
    errors.totalPracticalContactHours =
      'Set practical contact hours when practical credits are set';
  }

  return errors;
}

export function isManualCreditForm(
  deliveryType?: CourseDeliveryType,
  creditCalculationMode?: CreditCalculationMode,
): boolean {
  if (!deliveryType) return false;
  const mode = resolveCreditCalculationMode(deliveryType, creditCalculationMode);
  return mode === 'MANUAL_OVERRIDE' || isManualCreditDelivery(deliveryType);
}
