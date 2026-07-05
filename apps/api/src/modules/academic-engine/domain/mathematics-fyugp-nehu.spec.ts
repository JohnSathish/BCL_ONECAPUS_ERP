import {
  MATHEMATICS_MAJOR_ALLOWED_MINORS,
  MATHEMATICS_NEHU_PAPERS,
  MATHEMATICS_SEM5_MINOR_CODE,
  MATHEMATICS_SEM5_MINOR_TITLE,
  MATHEMATICS_SEM6_MINOR_CODE,
  MATHEMATICS_SEM6_MINOR_TITLE,
} from './mathematics-fyugp-nehu';

describe('mathematics-fyugp-nehu', () => {
  it('lists 16 NEHU Mathematics papers including internship MTH-303', () => {
    expect(MATHEMATICS_NEHU_PAPERS).toHaveLength(16);
    expect(MATHEMATICS_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'MTH-100',
      'MTH-150',
      'MTH-200',
      'MTH-201',
      'MTH-250',
      'MTH-251',
      'MTH-252',
      'MTH-253',
      'MTH-300',
      'MTH-301',
      'MTH-302',
      'MTH-303',
      'MTH-350',
      'MTH-351',
      'MTH-352',
      'MTH-353',
    ]);
  });

  it('uses four distinct Sem 6 major codes (NEHU MTH-352 dual title split to MTH-353)', () => {
    const sem6 = MATHEMATICS_NEHU_PAPERS.filter(
      (paper) => paper.semester === 6 && paper.category === 'MAJOR',
    );
    expect(sem6).toHaveLength(4);
    expect(sem6.map((paper) => paper.code)).toEqual([
      'MTH-350',
      'MTH-351',
      'MTH-352',
      'MTH-353',
    ]);
  });

  it('uses pure THEORY delivery for all honours papers', () => {
    const honours = MATHEMATICS_NEHU_PAPERS.filter(
      (paper) => paper.category === 'MAJOR',
    );
    for (const paper of honours) {
      expect(paper.deliveryKind).toBe('THEORY');
      expect(paper.theoryCredits).toBe(4);
      expect(paper.contactHours).toBe(60);
    }
  });

  it('documents Sem 5 and Sem 6 dual-listed minor codes', () => {
    expect(
      MATHEMATICS_NEHU_PAPERS.find((paper) => paper.code === 'MTH-302')?.title,
    ).toBe('Numerical Methods and Optimization Techniques');
    expect(MATHEMATICS_SEM5_MINOR_CODE).toBe('302');
    expect(MATHEMATICS_SEM5_MINOR_TITLE).toBe('Elementary Algebra');
    expect(
      MATHEMATICS_NEHU_PAPERS.find((paper) => paper.code === 'MTH-352')?.title,
    ).toBe('Discrete Mathematics');
    expect(MATHEMATICS_SEM6_MINOR_CODE).toBe('353');
    expect(MATHEMATICS_SEM6_MINOR_TITLE).toBe('Operations Research');
    expect(
      MATHEMATICS_NEHU_PAPERS.find((paper) => paper.code === 'MTH-353')?.title,
    ).toBe('Operations Research');
  });

  it('documents major-minor matrix for Mathematics', () => {
    expect(MATHEMATICS_MAJOR_ALLOWED_MINORS).toEqual(['Physics', 'Chemistry']);
  });
});
