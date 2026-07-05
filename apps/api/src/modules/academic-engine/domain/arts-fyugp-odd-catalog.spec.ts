import {
  ARTS_ODD_PAPER_BASKET,
  buildArtsFyugpOddCourses,
  buildArtsFyugpSem5MinorCourseDefs,
  buildArtsRoutineSampleRows,
} from './arts-fyugp-odd-catalog';

describe('arts-fyugp-odd-catalog', () => {
  it('builds 134 Arts ODD+EVEN-linked courses (9 depts + shared pools)', () => {
    const courses = buildArtsFyugpOddCourses();
    expect(courses).toHaveLength(134);
    expect(
      courses.some((c) => c.code === 'ECO-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'EDN-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'EDN-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'ENG-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'ENG-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'GAR-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'GAR-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'GEO-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some(
        (c) =>
          c.code === 'GEO-252' &&
          c.deliveryType === 'PRACTICAL' &&
          c.practicalCredits === 4,
      ),
    ).toBe(false);
    expect(
      courses.some(
        (c) =>
          c.code === 'GEO-300' &&
          c.deliveryType === 'PRACTICAL' &&
          c.practicalCredits === 4,
      ),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'GEO-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'HIS-200' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'HIS-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'PHI-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'PHI-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'POL-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'POL-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'SOC-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'SOC-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
    expect(
      courses.filter((c) => c.code === 'EDN-302').map((c) => c.category),
    ).toEqual(['MAJOR']);
    expect(
      courses.some((c) => c.code === 'VAC-140' && c.category === 'VAC'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'VTC-240' && c.category === 'VTC'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'ECO-303' && c.category === 'INTERNSHIP'),
    ).toBe(true);
  });

  it('documents sem 1/3/5 paper basket layout', () => {
    expect(
      ARTS_ODD_PAPER_BASKET.filter((row) => row.semester === 1),
    ).toHaveLength(6);
    expect(
      ARTS_ODD_PAPER_BASKET.filter((row) => row.semester === 3),
    ).toHaveLength(5);
    expect(
      ARTS_ODD_PAPER_BASKET.filter((row) => row.semester === 5),
    ).toHaveLength(3);
  });

  it('builds 17 sample routine rows for Economics major', () => {
    expect(buildArtsRoutineSampleRows()).toHaveLength(17);
  });

  it('builds cross-department Sem 5 minor mappings per BA programme', () => {
    const minors = buildArtsFyugpSem5MinorCourseDefs('BA-ECO');
    expect(minors).toHaveLength(8);
    expect(
      minors.some((row) => row.code === 'POL-302' && row.category === 'MINOR'),
    ).toBe(true);
    expect(minors.some((row) => row.code === 'POL-303')).toBe(false);
    expect(
      minors.some((row) => row.code === 'ECO-302' && row.category === 'MINOR'),
    ).toBe(false);
    const geoMinors = buildArtsFyugpSem5MinorCourseDefs('BA-GEO');
    expect(
      geoMinors.some(
        (row) => row.code === 'ECO-302' && row.category === 'MINOR',
      ),
    ).toBe(true);
    expect(minors.some((row) => row.code === 'ECO-303')).toBe(false);
  });
});
