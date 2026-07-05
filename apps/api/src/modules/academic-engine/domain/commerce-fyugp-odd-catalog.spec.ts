import { buildCommerceFyugpOddCourses } from './commerce-fyugp-odd-catalog';
import { buildCommerceOddSemCourses } from './commerce-fyugp-nehu.util';

describe('commerce-fyugp-odd-catalog', () => {
  it('includes 7 Commerce odd-semester major/internship papers', () => {
    const commerce = buildCommerceOddSemCourses();
    expect(commerce).toHaveLength(7);
    expect(commerce.map((course) => course.code)).toEqual([
      'COM-100',
      'COM-200',
      'COM-201',
      'COM-300',
      'COM-301',
      'COM-302',
      'COM-303',
    ]);
  });

  it('builds commerce odd catalog', () => {
    expect(buildCommerceFyugpOddCourses()).toHaveLength(7);
  });
});
