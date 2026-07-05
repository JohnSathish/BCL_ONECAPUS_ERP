import {
  ZOOLOGY_MAJOR_ALLOWED_MINORS,
  ZOOLOGY_NEHU_PAPERS,
  ZOOLOGY_SEM5_MINOR_CODE,
  ZOOLOGY_SEM5_MINOR_TITLE,
} from './zoology-fyugp-nehu';

describe('zoology-fyugp-nehu', () => {
  it('lists 16 NEHU Zoology papers including internship ZOO-303', () => {
    expect(ZOOLOGY_NEHU_PAPERS).toHaveLength(16);
    expect(ZOOLOGY_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'ZOO-100',
      'ZOO-150',
      'ZOO-200',
      'ZOO-201',
      'ZOO-250',
      'ZOO-251',
      'ZOO-252',
      'ZOO-253',
      'ZOO-300',
      'ZOO-301',
      'ZOO-302',
      'ZOO-303',
      'ZOO-350',
      'ZOO-351',
      'ZOO-352',
      'ZOO-353',
    ]);
  });

  it('uses four distinct Sem 6 major codes', () => {
    const sem6 = ZOOLOGY_NEHU_PAPERS.filter(
      (paper) => paper.semester === 6 && paper.category === 'MAJOR',
    );
    expect(sem6).toHaveLength(4);
    expect(sem6.map((paper) => paper.code)).toEqual([
      'ZOO-350',
      'ZOO-351',
      'ZOO-352',
      'ZOO-353',
    ]);
  });

  it('uses 60 contact hours for Sem 1–2 and 75 for later THEORY_PRACTICAL papers', () => {
    expect(
      ZOOLOGY_NEHU_PAPERS.find((p) => p.code === 'ZOO-100')?.contactHours,
    ).toBe(60);
    expect(
      ZOOLOGY_NEHU_PAPERS.find((p) => p.code === 'ZOO-200')?.contactHours,
    ).toBe(75);
    expect(
      ZOOLOGY_NEHU_PAPERS.find((p) => p.code === 'ZOO-350')?.deliveryKind,
    ).toBe('THEORY');
  });

  it('documents Sem 5 dual-listed minor on ZOO-302', () => {
    expect(
      ZOOLOGY_NEHU_PAPERS.find((paper) => paper.code === 'ZOO-302')?.title,
    ).toBe('Introductory Developmental Biology and Endocrinology');
    expect(ZOOLOGY_SEM5_MINOR_CODE).toBe('302');
    expect(ZOOLOGY_SEM5_MINOR_TITLE).toBe('Economic and Applied Zoology');
  });

  it('documents major-minor matrix for Zoology', () => {
    expect(ZOOLOGY_MAJOR_ALLOWED_MINORS).toEqual(['Botany', 'Chemistry']);
  });
});
