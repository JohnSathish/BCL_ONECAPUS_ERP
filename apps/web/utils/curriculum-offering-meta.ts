import type { CourseOffering } from '@/types/programs';
import { formatCourseDeliverySummary } from '@/utils/course-delivery-meta';

export function formatOfferingCredits(credits: string | number | null | undefined): string {
  const n = Number(credits);
  if (!Number.isFinite(n)) return 'Credits —';
  return n === 1 ? '1 Credit' : `${n} Credits`;
}

export function formatSemesterLabel(sequence: number | null | undefined): string | null {
  if (sequence == null || sequence < 1) return null;
  return `Semester ${sequence}`;
}

export function isSharedPoolOffering(
  o: Pick<CourseOffering, 'programVersionId' | 'mappingSource'>,
): boolean {
  return o.mappingSource === 'SHARED_POOL' || o.programVersionId == null;
}

export function formatOfferingProgramLabel(o: CourseOffering): string {
  if (isSharedPoolOffering(o)) {
    return 'Shared pool';
  }
  return `${o.programVersion!.program.code} v${o.programVersion!.version}`;
}

/** Programme · NEP role · semester · credits — never concatenates digits (avoids "Sem 13 cr"). */
export function formatCurriculumMetaLine(o: CourseOffering): string {
  const parts: string[] = [formatOfferingProgramLabel(o)];
  if (o.category) parts.push(o.category);
  const sem = formatSemesterLabel(o.semesterSequence);
  if (sem) parts.push(sem);
  parts.push(formatCourseDeliverySummary(o.course));
  return parts.join(' · ');
}
