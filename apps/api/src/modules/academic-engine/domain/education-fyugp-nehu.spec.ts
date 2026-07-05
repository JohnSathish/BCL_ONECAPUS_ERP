import { EDUCATION_NEHU_PAPERS } from './education-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('education-fyugp-nehu', () => {
  it('lists NEHU Education papers with standard EDN-### codes', () => {
    expect(EDUCATION_NEHU_PAPERS).toHaveLength(16);
    for (const paper of EDUCATION_NEHU_PAPERS) {
      expect(paper.code.startsWith('EDN-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(EDUCATION_NEHU_PAPERS.map((paper) => paper.code)).toContain(
      'EDN-303',
    );
  });
});
