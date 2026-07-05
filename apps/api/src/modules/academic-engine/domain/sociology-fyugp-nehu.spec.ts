import { SOCIOLOGY_NEHU_PAPERS } from './sociology-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('sociology-fyugp-nehu', () => {
  it('lists NEHU Sociology papers with standard SOC-### codes', () => {
    expect(SOCIOLOGY_NEHU_PAPERS).toHaveLength(16);
    for (const paper of SOCIOLOGY_NEHU_PAPERS) {
      expect(paper.code.startsWith('SOC-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(SOCIOLOGY_NEHU_PAPERS.map((paper) => paper.code)).toContain(
      'SOC-303',
    );
  });

  it('aligns Sem 3–6 papers with NEHU FYUGP syllabus', () => {
    expect(
      SOCIOLOGY_NEHU_PAPERS.find((paper) => paper.code === 'SOC-200')?.title,
    ).toBe('Society in India');
    expect(
      SOCIOLOGY_NEHU_PAPERS.find((paper) => paper.code === 'SOC-302')?.notes,
    ).toContain('MINOR');
    expect(
      SOCIOLOGY_NEHU_PAPERS.find((paper) => paper.code === 'SOC-150')?.title,
    ).toBe('Principles of Sociology');
  });
});
