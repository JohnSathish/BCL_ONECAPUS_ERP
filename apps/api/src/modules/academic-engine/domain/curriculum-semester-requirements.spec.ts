import {
  minimumDirectOfferingCounts,
  requiredSemesterCategories,
  semesterCurriculumMode,
} from './curriculum-semester-requirements';

describe('curriculum-semester-requirements', () => {
  it('uses direct offerings for semester 5', () => {
    expect(semesterCurriculumMode(5)).toBe('direct-offerings');
    expect(requiredSemesterCategories(5)).toEqual([
      'MAJOR',
      'MINOR',
      'INTERNSHIP',
    ]);
    expect(minimumDirectOfferingCounts(5)).toEqual({
      MAJOR: 3,
      MINOR: 1,
      INTERNSHIP: 1,
    });
  });

  it('uses shift pools for semester 3', () => {
    expect(semesterCurriculumMode(3)).toBe('shift-pools');
    expect(requiredSemesterCategories(3)).toEqual(['MDC', 'AEC', 'SEC', 'VTC']);
  });
});
