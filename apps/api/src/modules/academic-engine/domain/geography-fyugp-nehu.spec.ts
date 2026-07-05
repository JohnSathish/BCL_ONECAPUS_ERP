import {
  GEOGRAPHY_NEHU_PAPERS,
  GEOGRAPHY_SEM5_MINOR_TITLE,
} from './geography-fyugp-nehu';
import {
  buildGeographyHonoursEvenSemCourses,
  geographyPracticalCourseCodes,
} from './geography-fyugp-nehu.util';
import { isValidNehuCourseCode } from './course-code.util';

describe('geography-fyugp-nehu', () => {
  it('lists NEHU Geography papers with standard GEO-### codes', () => {
    expect(GEOGRAPHY_NEHU_PAPERS).toHaveLength(16);
    for (const paper of GEOGRAPHY_NEHU_PAPERS) {
      expect(paper.code.startsWith('GEO-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(GEOGRAPHY_NEHU_PAPERS.map((paper) => paper.code)).toContain(
      'GEO-303',
    );
  });

  it('marks practical geography papers for lab fee routing', () => {
    const practicalCodes = geographyPracticalCourseCodes();
    expect(practicalCodes).toEqual(
      expect.arrayContaining([
        'GEO-252',
        'GEO-253',
        'GEO-300',
        'GEO-302',
        'GEO-353',
      ]),
    );
    expect(
      GEOGRAPHY_NEHU_PAPERS.find((paper) => paper.code === 'GEO-302')?.notes,
    ).toContain('MINOR');
    expect(GEOGRAPHY_SEM5_MINOR_TITLE).toBe('Geography and Environment');
  });

  it('builds sem 4 honours with practical delivery for GEO-252', () => {
    const courses = buildGeographyHonoursEvenSemCourses();
    const geo252 = courses.find((course) => course.code === 'GEO-252');
    expect(geo252?.deliveryType).toBe('PRACTICAL');
    expect(geo252?.practicalCredits).toBe(4);
    expect(geo252?.totalPracticalContactHours).toBe(120);
  });
});
