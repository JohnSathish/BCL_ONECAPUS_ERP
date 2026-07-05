import { buildScienceFyugpOddCourses } from './science-fyugp-odd-catalog';
import { buildPhysicsOddSemCourses } from './physics-fyugp-nehu.util';

describe('science-fyugp-odd-catalog', () => {
  it('includes 7 Physics odd-semester major/internship papers', () => {
    const physics = buildPhysicsOddSemCourses();
    expect(physics).toHaveLength(7);
    expect(physics.map((course) => course.code)).toEqual([
      'PHY-100',
      'PHY-200',
      'PHY-201',
      'PHY-300',
      'PHY-301',
      'PHY-302',
      'PHY-303',
    ]);
  });

  it('builds science odd catalog from all five NEHU-aligned departments', () => {
    expect(buildScienceFyugpOddCourses()).toHaveLength(35);
  });
});
