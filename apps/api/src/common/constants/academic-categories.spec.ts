import {
  isNepCurriculumCategory,
  NEP_CURRICULUM_CATEGORIES,
} from './academic-categories';

describe('NEP_CURRICULUM_CATEGORIES', () => {
  it('includes experiential mapping categories', () => {
    expect(NEP_CURRICULUM_CATEGORIES).toEqual(
      expect.arrayContaining([
        'INTERNSHIP',
        'PROJECT',
        'RESEARCH',
        'DISSERTATION',
      ]),
    );
  });

  it('accepts INTERNSHIP for curriculum mapping validation', () => {
    expect(isNepCurriculumCategory('INTERNSHIP')).toBe(true);
    expect(isNepCurriculumCategory('PROJECT')).toBe(true);
    expect(isNepCurriculumCategory('RESEARCH')).toBe(true);
  });
});
