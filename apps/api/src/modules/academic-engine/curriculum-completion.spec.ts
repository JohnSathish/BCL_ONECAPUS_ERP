import {
  buildMissingItemsFromCell,
  evaluateCompletionCell,
  rollupStatus,
  sortCategories,
} from './domain/curriculum-completion.helpers';

describe('curriculum-completion.helpers', () => {
  const baseOffering = (
    overrides?: Partial<{
      id: string;
      category: string;
      sections: Array<{
        id: string;
        sectionCode: string;
        shiftId: string | null;
        capacity: number;
        staffProfileId?: string | null;
      }>;
    }>,
  ) => ({
    id: overrides?.id ?? 'off-1',
    category: overrides?.category ?? 'MDC',
    courseId: 'course-1',
    mappingSource: 'DIRECT',
    course: {
      id: 'course-1',
      code: 'MDC-101',
      title: 'MDC Course',
      credits: 3,
    },
    sections: overrides?.sections ?? [],
  });

  it('sorts categories in FYUGP display order', () => {
    expect(sortCategories(['VAC', 'MAJOR', 'MDC'])).toEqual([
      'MAJOR',
      'MDC',
      'VAC',
    ]);
  });

  it('marks cell NOT_CONFIGURED when nothing mapped', () => {
    const result = evaluateCompletionCell({
      category: 'MDC',
      required: 1,
      directOfferings: [],
      poolOfferings: [],
      poolAssigned: true,
      isPoolEligible: true,
      hasStructureRule: true,
      expectedCredits: 3,
    });
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.issues).toContain('MISSING_CATEGORY');
  });

  it('marks cell COMPLETE when count and mapping satisfied', () => {
    const majorOffering = {
      id: 'off-1',
      category: 'MAJOR',
      courseId: 'course-1',
      mappingSource: 'DIRECT',
      course: { id: 'course-1', code: 'MAJ-101', title: 'Major', credits: 4 },
      sections: [
        {
          id: 'sec-1',
          sectionCode: 'A',
          shiftId: 'shift-1',
          capacity: 80,
          staffProfileId: 'staff-1',
        },
      ],
    };
    const result = evaluateCompletionCell({
      category: 'MAJOR',
      required: 1,
      directOfferings: [majorOffering],
      poolOfferings: [],
      poolAssigned: false,
      isPoolEligible: false,
      hasStructureRule: true,
      expectedCredits: 4,
    });
    expect(result.status).toBe('COMPLETE');
  });

  it('marks cell PARTIAL when mapping incomplete', () => {
    const result = evaluateCompletionCell({
      category: 'MAJOR',
      required: 1,
      directOfferings: [
        baseOffering({
          category: 'MAJOR',
          sections: [
            { id: 'sec-1', sectionCode: 'A', shiftId: null, capacity: 80 },
          ],
        }),
      ],
      poolOfferings: [],
      poolAssigned: false,
      isPoolEligible: false,
      hasStructureRule: true,
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.issues).toContain('MISSING_SECTION');
  });

  it('flags MISSING_POOL for pool categories without assignment', () => {
    const result = evaluateCompletionCell({
      category: 'AEC',
      required: 1,
      directOfferings: [],
      poolOfferings: [],
      poolAssigned: false,
      isPoolEligible: true,
      hasStructureRule: true,
    });
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.issues).toContain('MISSING_POOL');
  });

  it('rolls up semester status', () => {
    expect(rollupStatus(['COMPLETE', 'COMPLETE'])).toBe('COMPLETE');
    expect(rollupStatus(['COMPLETE', 'NOT_CONFIGURED'])).toBe('PARTIAL');
    expect(rollupStatus(['NOT_CONFIGURED', 'NOT_CONFIGURED'])).toBe(
      'NOT_CONFIGURED',
    );
  });

  it('builds missing items with quick actions', () => {
    const cell = evaluateCompletionCell({
      category: 'MDC',
      required: 1,
      directOfferings: [],
      poolOfferings: [],
      poolAssigned: false,
      isPoolEligible: true,
      hasStructureRule: true,
    });
    const items = buildMissingItemsFromCell({
      programVersionId: 'pv-1',
      programCode: 'BA-ECO',
      programName: 'BA Economics',
      semesterSequence: 1,
      cell,
      directOfferings: [],
      poolOfferings: [],
    });
    expect(items.some((i) => i.quickAction === 'ADD_SHARED_POOL')).toBe(true);
  });
});
