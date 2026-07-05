import {
  buildArtsFyugpEvenCourses,
  buildArtsFyugpSem2MinorCourseDefs,
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_VAC_CODES,
  MORNING_SEM2_MDC_CODES,
  MORNING_SEM2_VAC_CODES,
} from './arts-fyugp-even-catalog';

describe('arts-fyugp-even-catalog', () => {
  it('builds Sem 2 global courses without duplicate codes', () => {
    const courses = buildArtsFyugpEvenCourses();
    const codes = courses.map((course) => course.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(courses.length).toBeGreaterThanOrEqual(41);
    expect(
      courses.some(
        (course) => course.code === 'ECO-150' && course.category === 'MAJOR',
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'POL-151' && course.category === 'MINOR',
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'AEC-173' && course.category === 'AEC',
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'EDN-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'EDN-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'ENG-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'ENG-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'GAR-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'GAR-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) =>
          course.code === 'GEO-252' &&
          course.semesterSequence === 4 &&
          course.deliveryType === 'PRACTICAL',
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) =>
          course.code === 'GEO-353' &&
          course.semesterSequence === 6 &&
          course.deliveryType === 'PRACTICAL',
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'HIS-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'HIS-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'PHI-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'PHI-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'POL-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'POL-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'SOC-253' && course.semesterSequence === 4,
      ),
    ).toBe(true);
    expect(
      courses.some(
        (course) => course.code === 'SOC-353' && course.semesterSequence === 6,
      ),
    ).toBe(true);
  });

  it('documents Morning vs Day Sem 2 pool code sets', () => {
    expect([...MORNING_SEM2_MDC_CODES]).toEqual([
      'MDC-162',
      'MDC-163',
      'MDC-165',
      'MDC-168',
      'MDC-169',
    ]);
    expect([...MORNING_SEM2_VAC_CODES]).toEqual(['VAC-191', 'VAC-192']);
    expect([...DAY_SEM2_MDC_CODES]).toEqual([
      'MDC-161',
      'MDC-162',
      'MDC-163',
      'MDC-164',
      'MDC-165',
      'MDC-167',
      'MDC-168',
      'MDC-169',
    ]);
    expect([...DAY_SEM2_AEC_CODES]).toEqual(['AEC-170', 'AEC-173']);
    expect([...DAY_SEM2_SEC_CODES]).toEqual([
      'SEC-180',
      'SEC-181',
      'SEC-182',
      'SEC-183',
    ]);
    expect([...DAY_SEM2_VAC_CODES]).toEqual(['VAC-190', 'VAC-191', 'VAC-192']);
  });

  it('builds cross-department Sem 2 minor defs per FYUGP programme using -151', () => {
    const minors = buildArtsFyugpSem2MinorCourseDefs('BA-ECO');
    expect(minors.length).toBeGreaterThanOrEqual(8);
    expect(minors.every((course) => course.category === 'MINOR')).toBe(true);
    expect(minors.some((course) => course.code === 'POL-151')).toBe(true);
    expect(minors.some((course) => course.code === 'POL-150')).toBe(false);
    expect(minors.some((course) => course.code === 'ECO-151')).toBe(false);
  });
});
