import type { CatalogSectionRow } from '@/types/academic-engine';

export function expectedVtcStageForSemester(semesterSequence: number): number | null {
  if (semesterSequence === 3) return 1;
  if (semesterSequence === 4) return 2;
  if (semesterSequence === 6) return 3;
  return null;
}

export function filterVtcSectionsForTrack(
  sections: CatalogSectionRow[],
  semesterSequence: number,
  trackGroupCode?: string | null,
): CatalogSectionRow[] {
  const expectedStage = expectedVtcStageForSemester(semesterSequence);
  if (!expectedStage) return sections;
  if (semesterSequence === 3 || !trackGroupCode) return sections;

  return sections.filter((s) => {
    const course = s.courseOffering.course;
    return course.vtcTrackGroupCode === trackGroupCode && course.vtcTrackStage === expectedStage;
  });
}

export function electiveSlotBadge(
  category: string,
  semesterSequence: number,
  opts?: { vtcTrackGroupCode?: string | null },
): string | undefined {
  if (['MDC', 'AEC', 'SEC', 'VAC'].includes(category)) return 'Semester choice';
  if (category === 'VTC' && opts?.vtcTrackGroupCode && semesterSequence > 3) {
    const stage = expectedVtcStageForSemester(semesterSequence);
    return stage ? `Continuing Track · Stage ${stage}` : 'Continuing Track';
  }
  return undefined;
}
