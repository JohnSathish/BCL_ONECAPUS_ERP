import { BadRequestException } from '@nestjs/common';
import type {
  CourseDeliveryType,
  CreditCalculationMode,
} from '../constants/course-delivery';
import { getDeliveryProfile } from '../constants/course-delivery';

export type CourseAcademicStructureInput = {
  deliveryType?: CourseDeliveryType;
  creditCalculationMode?: CreditCalculationMode;
  credits?: number;
  theoryCredits: number;
  practicalCredits: number;
  theoryHoursPerWeek: number;
  practicalHoursPerWeek: number;
  totalTheoryContactHours: number;
  totalPracticalContactHours: number;
  totalContactHours?: number;
};

export function computeTotalContactHours(
  theory: number,
  practical: number,
): number {
  return Math.max(0, theory) + Math.max(0, practical);
}

export function validateCourseAcademicStructure(
  input: CourseAcademicStructureInput,
): void {
  const deliveryType = input.deliveryType ?? 'THEORY';
  const profile = getDeliveryProfile(deliveryType);
  const mode = input.creditCalculationMode ?? profile.creditCalculationMode;

  const theoryCredits = Math.max(0, input.theoryCredits);
  const practicalCredits = Math.max(0, input.practicalCredits);
  const theoryWeekly = Math.max(0, input.theoryHoursPerWeek);
  const practicalWeekly = Math.max(0, input.practicalHoursPerWeek);
  const theoryContact = Math.max(0, input.totalTheoryContactHours);
  const practicalContact = Math.max(0, input.totalPracticalContactHours);
  const totalContact = Math.max(0, input.totalContactHours ?? 0);
  const credits = Math.max(
    0,
    input.credits ?? theoryCredits + practicalCredits,
  );

  if (mode === 'MANUAL_OVERRIDE') {
    if (credits <= 0) {
      throw new BadRequestException('Total credits must be greater than zero');
    }
    if (totalContact <= 0) {
      throw new BadRequestException(
        'Total contact hours must be greater than zero for this delivery type',
      );
    }
    if (theoryCredits > 0 && theoryWeekly > 0 && profile.requiresWeeklyHours) {
      /* allowed */
    }
    if (theoryCredits === 0 && theoryWeekly > 0) {
      throw new BadRequestException(
        'Weekly theory hours must be 0 when theory credits are 0',
      );
    }
    if (practicalCredits === 0 && practicalWeekly > 0) {
      throw new BadRequestException(
        'Weekly practical hours must be 0 when practical credits are 0',
      );
    }
    if (
      theoryCredits === 0 &&
      theoryContact > 0 &&
      profile.requiresSplitContactHours
    ) {
      throw new BadRequestException(
        'Total theory contact hours must be 0 when theory credits are 0',
      );
    }
    if (
      practicalCredits === 0 &&
      practicalContact > 0 &&
      profile.requiresSplitContactHours
    ) {
      throw new BadRequestException(
        'Total practical contact hours must be 0 when practical credits are 0',
      );
    }
    return;
  }

  if (deliveryType === 'THEORY' && theoryCredits <= 0) {
    throw new BadRequestException(
      'Theory credits are required for a theory course',
    );
  }

  if (deliveryType === 'PRACTICAL' && practicalCredits <= 0) {
    throw new BadRequestException(
      'Practical credits are required for a practical course',
    );
  }

  if (theoryCredits + practicalCredits <= 0) {
    throw new BadRequestException('Total credits must be greater than zero');
  }

  if (theoryCredits === 0 && theoryWeekly > 0) {
    throw new BadRequestException(
      'Weekly theory hours must be 0 when theory credits are 0',
    );
  }
  if (practicalCredits === 0 && practicalWeekly > 0) {
    throw new BadRequestException(
      'Weekly practical hours must be 0 when practical credits are 0',
    );
  }
  if (theoryCredits === 0 && theoryContact > 0) {
    throw new BadRequestException(
      'Total theory contact hours must be 0 when theory credits are 0',
    );
  }
  if (practicalCredits === 0 && practicalContact > 0) {
    throw new BadRequestException(
      'Total practical contact hours must be 0 when practical credits are 0',
    );
  }

  if (theoryCredits > 0 && theoryContact <= 0) {
    throw new BadRequestException(
      'Total theory contact hours must be greater than 0 when theory credits are set',
    );
  }
  if (practicalCredits > 0 && practicalContact <= 0) {
    throw new BadRequestException(
      'Total practical contact hours must be greater than 0 when practical credits are set',
    );
  }
}
