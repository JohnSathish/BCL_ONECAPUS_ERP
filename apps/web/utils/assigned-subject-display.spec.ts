import {
  buildAssignedSubjectRows,
  detectDuplicateCourseCodes,
  formatCourseLine,
} from '@/utils/assigned-subject-display';
import type { CatalogSectionRow } from '@/types/academic-engine';

function majorRow(
  code: string,
  title: string,
  majorPaperIndex: number | null,
  offeringId: string,
): CatalogSectionRow {
  return {
    id: `section-${code}`,
    sectionCode: 'A',
    capacity: 40,
    waitlistCapacity: 10,
    shift: { id: 'shift-1', code: 'M', name: 'Morning' },
    courseOffering: {
      id: offeringId,
      category: 'MAJOR',
      semesterSequence: 3,
      majorPaperIndex,
      course: { code, title, credits: 4 },
    },
  };
}

describe('assigned-subject-display', () => {
  it('detects duplicate course codes across auto-assigned slots', () => {
    const sections = [
      majorRow('ECO-200', 'Economics of Growth', 1, 'off-1'),
      majorRow('ECO-200', 'Economics of Growth', 1, 'off-1'),
    ];
    expect(detectDuplicateCourseCodes(sections).hasDuplicates).toBe(true);
    expect(detectDuplicateCourseCodes(sections).duplicateCodes).toEqual(['ECO-200']);
  });

  it('formats course assignment line', () => {
    const section = majorRow('ECO-201', 'Indian Economy', 2, 'off-2');
    expect(formatCourseLine(section)).toBe('ECO-201 — Indian Economy');
  });

  it('builds preview rows from slot selections', () => {
    const catalog = [
      majorRow('ECO-200', 'Economics of Growth', 1, 'off-1'),
      majorRow('ECO-201', 'Indian Economy', 2, 'off-2'),
    ];
    const rows = buildAssignedSubjectRows({
      slotKeys: ['MAJOR-1', 'MAJOR-2'],
      autoSlotKeys: ['MAJOR-1', 'MAJOR-2'],
      selections: { 'MAJOR-1': 'section-ECO-200', 'MAJOR-2': 'section-ECO-201' },
      catalog,
      resolveSection: () => undefined,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].section?.courseOffering.course.code).toBe('ECO-200');
    expect(rows[1].section?.courseOffering.course.code).toBe('ECO-201');
  });
});
