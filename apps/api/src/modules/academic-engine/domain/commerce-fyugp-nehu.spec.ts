import {
  COMMERCE_MAJOR_ALLOWED_MINORS,
  COMMERCE_NEHU_PAPERS,
} from './commerce-fyugp-nehu';

describe('commerce-fyugp-nehu', () => {
  it('lists 16 NEHU Commerce papers including internship COM-303', () => {
    expect(COMMERCE_NEHU_PAPERS).toHaveLength(16);
    expect(COMMERCE_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'COM-100',
      'COM-150',
      'COM-200',
      'COM-201',
      'COM-250',
      'COM-251',
      'COM-252',
      'COM-253',
      'COM-300',
      'COM-301',
      'COM-302',
      'COM-303',
      'COM-350',
      'COM-351',
      'COM-352',
      'COM-353',
    ]);
  });

  it('uses four distinct Sem 4 and Sem 6 major codes', () => {
    const sem4 = COMMERCE_NEHU_PAPERS.filter(
      (paper) => paper.semester === 4 && paper.category === 'MAJOR',
    );
    expect(sem4).toHaveLength(4);

    const sem6 = COMMERCE_NEHU_PAPERS.filter(
      (paper) => paper.semester === 6 && paper.category === 'MAJOR',
    );
    expect(sem6).toHaveLength(4);
  });

  it('uses 60 contact hours for Sem 1–3 and 45 for Sem 4–6', () => {
    expect(
      COMMERCE_NEHU_PAPERS.find((p) => p.code === 'COM-100')?.contactHours,
    ).toBe(60);
    expect(
      COMMERCE_NEHU_PAPERS.find((p) => p.code === 'COM-250')?.contactHours,
    ).toBe(45);
  });

  it('documents major-minor matrix for Commerce', () => {
    expect(COMMERCE_MAJOR_ALLOWED_MINORS).toEqual([
      'Economics',
      'Mathematics',
      'Geography',
    ]);
  });
});
