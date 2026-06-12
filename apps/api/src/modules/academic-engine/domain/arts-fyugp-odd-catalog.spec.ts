import {
  ARTS_ODD_PAPER_BASKET,
  buildArtsFyugpOddCourses,
  buildArtsRoutineSampleRows,
} from './arts-fyugp-odd-catalog';

describe('arts-fyugp-odd-catalog', () => {
  it('builds 143 Arts ODD courses (9 depts + shared pools)', () => {
    const courses = buildArtsFyugpOddCourses();
    expect(courses).toHaveLength(143);
    expect(
      courses.some((c) => c.code === 'ECO-100' && c.category === 'MAJOR'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'VAC-140' && c.category === 'VAC'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'VTC-240' && c.category === 'VTC'),
    ).toBe(true);
    expect(
      courses.some((c) => c.code === 'ECO-304' && c.category === 'INTERNSHIP'),
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
});
