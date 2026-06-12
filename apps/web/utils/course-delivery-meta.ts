import {
  COURSE_DELIVERY_LABELS,
  getDeliveryProfile,
  isManualCreditDelivery,
  resolveDeliveryType,
  type CourseDeliveryType,
} from '@/constants/course-delivery';

export type CourseDeliveryFields = {
  deliveryType?: string | null;
  creditCalculationMode?: string | null;
  requiresTheorySplit?: boolean | null;
  requiresPracticalSplit?: boolean | null;
  credits?: string | number | null;
  theoryCredits?: string | number | null;
  practicalCredits?: string | number | null;
  totalTheoryContactHours?: number | null;
  totalPracticalContactHours?: number | null;
  totalContactHours?: number | null;
};

function resolveDelivery(deliveryType: string | null | undefined): CourseDeliveryType | null {
  if (!deliveryType) return null;
  return resolveDeliveryType(deliveryType);
}

function usesDirectCreditDisplay(course: CourseDeliveryFields): boolean {
  if (course.creditCalculationMode === 'MANUAL_OVERRIDE') return true;
  if (course.requiresTheorySplit === false && course.requiresPracticalSplit === false) {
    return true;
  }
  const resolved = resolveDelivery(course.deliveryType);
  if (resolved && isManualCreditDelivery(resolved)) return true;
  const theory = Number(course.theoryCredits ?? 0);
  const practical = Number(course.practicalCredits ?? 0);
  return theory === 0 && practical === 0;
}

export function formatDeliveryTypeLabel(deliveryType: string | null | undefined): string {
  if (!deliveryType) return 'Theory';
  const key = resolveDelivery(deliveryType) ?? (deliveryType as CourseDeliveryType);
  return COURSE_DELIVERY_LABELS[key] ?? deliveryType;
}

export function formatCourseTotalCredits(course: CourseDeliveryFields): string {
  const theory = Number(course.theoryCredits ?? 0);
  const practical = Number(course.practicalCredits ?? 0);
  const total = theory + practical > 0 ? theory + practical : Number(course.credits ?? 0);
  if (!Number.isFinite(total)) return 'Credits —';
  return total === 1 ? '1 Credit' : `${total} Credits`;
}

/** e.g. "Theory 4 + Practical 0" — omitted when direct allocation applies */
export function formatCourseCreditsLine(course: CourseDeliveryFields): string {
  if (usesDirectCreditDisplay(course)) {
    return formatCourseTotalCredits(course);
  }
  const theory = Number(course.theoryCredits ?? 0);
  const practical = Number(course.practicalCredits ?? 0);
  return `Theory ${theory} + Practical ${practical}`;
}

/** e.g. "120 Contact Hours" for experiential; split detail when applicable */
export function formatCourseContactHoursLine(course: CourseDeliveryFields): string {
  const theory = Number(course.totalTheoryContactHours ?? 0);
  const practical = Number(course.totalPracticalContactHours ?? 0);
  const total =
    Number(course.totalContactHours ?? 0) > 0
      ? Number(course.totalContactHours)
      : theory + practical;

  if (total <= 0) return 'Contact hours not set';

  if (usesDirectCreditDisplay(course)) {
    return `${total} Contact Hours`;
  }

  if (theory > 0 && practical > 0) {
    return `Theory: ${theory}h · Practical: ${practical}h · Total: ${total}h`;
  }
  if (practical > 0) {
    return `${practical} Contact Hours`;
  }
  return `${theory || total} Contact Hours`;
}

export function formatCourseDeliverySummary(course: CourseDeliveryFields): string {
  return `${formatDeliveryTypeLabel(course.deliveryType)} · ${formatCourseTotalCredits(course)}`;
}

/** Full catalog subtitle: delivery, credits, optional split, contact hours */
export function formatCourseCatalogMeta(course: CourseDeliveryFields): string {
  const parts = [formatCourseDeliverySummary(course)];
  if (!usesDirectCreditDisplay(course)) {
    const theory = Number(course.theoryCredits ?? 0);
    const practical = Number(course.practicalCredits ?? 0);
    parts.push(`Theory ${theory} + Practical ${practical}`);
  }
  parts.push(formatCourseContactHoursLine(course));
  return parts.join(' · ');
}
