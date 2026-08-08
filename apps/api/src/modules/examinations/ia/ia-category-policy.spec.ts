import {
  defaultCategoriesForSemester,
  filterOfferingsByCategoryPolicy,
  isCategoryEnabledForSemester,
  normalizeIaSubjectCategory,
  resolveCategoryPolicy,
} from './ia-category-policy';

describe('normalizeIaSubjectCategory', () => {
  it('normalizes families including VTC and INTERNSHIP', () => {
    expect(normalizeIaSubjectCategory('MAJOR_CORE')).toBe('MAJOR');
    expect(normalizeIaSubjectCategory('VTC')).toBe('VTC');
    expect(normalizeIaSubjectCategory('Internship')).toBe('INTERNSHIP');
  });
});

describe('resolveCategoryPolicy', () => {
  it('returns null when policy omitted (legacy include-all)', () => {
    expect(resolveCategoryPolicy([1, 3], null)).toBeNull();
    expect(resolveCategoryPolicy([1, 3], undefined)).toBeNull();
  });

  it('fills FYUGP printed defaults when requested', () => {
    expect(
      resolveCategoryPolicy([1, 3, 5], null, { fillDefaultsWhenEmpty: true }),
    ).toEqual({
      1: ['MAJOR', 'MINOR', 'AEC', 'MDC', 'SEC', 'VAC'],
      3: ['MAJOR', 'AEC', 'MDC', 'SEC'],
      5: ['MAJOR', 'MINOR'],
    });
  });

  it('merges partial maps with defaults for missing semesters', () => {
    expect(
      resolveCategoryPolicy([1, 5], {
        1: ['MAJOR', 'VTC'],
      }),
    ).toEqual({
      1: ['MAJOR', 'VTC'],
      5: defaultCategoriesForSemester(5),
    });
  });
});

describe('filterOfferingsByCategoryPolicy', () => {
  const offerings = [
    { id: '1', semesterSequence: 3, category: 'MAJOR' },
    { id: '2', semesterSequence: 3, category: 'VTC' },
    { id: '3', semesterSequence: 5, category: 'INTERNSHIP' },
    { id: '4', semesterSequence: 5, category: 'MAJOR' },
  ];

  it('keeps all offerings when policy is null', () => {
    expect(filterOfferingsByCategoryPolicy(offerings, null)).toHaveLength(4);
  });

  it('excludes VTC and INTERNSHIP when disabled', () => {
    const policy = resolveCategoryPolicy([3, 5], {
      3: ['MAJOR', 'AEC', 'MDC', 'SEC'],
      5: ['MAJOR', 'MINOR'],
    });
    const filtered = filterOfferingsByCategoryPolicy(offerings, policy);
    expect(filtered.map((o) => o.id)).toEqual(['1', '4']);
  });

  it('isCategoryEnabledForSemester respects policy', () => {
    const policy = { 3: ['MAJOR'] };
    expect(isCategoryEnabledForSemester('MAJOR', 3, policy)).toBe(true);
    expect(isCategoryEnabledForSemester('VTC', 3, policy)).toBe(false);
    expect(isCategoryEnabledForSemester('MAJOR', 3, null)).toBe(true);
  });
});
