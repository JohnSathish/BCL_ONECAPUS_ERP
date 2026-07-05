import {
  CHEMISTRY_MAJOR_ALLOWED_MINORS,
  CHEMISTRY_NEHU_PAPERS,
  CHEMISTRY_SEM5_MINOR_CODE,
  CHEMISTRY_SEM5_MINOR_TITLE,
} from './chemistry-fyugp-nehu';

describe('chemistry-fyugp-nehu', () => {
  it('lists 16 NEHU Chemistry papers including internship CHE-303', () => {
    expect(CHEMISTRY_NEHU_PAPERS).toHaveLength(16);
    expect(CHEMISTRY_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'CHE-100',
      'CHE-150',
      'CHE-200',
      'CHE-201',
      'CHE-250',
      'CHE-251',
      'CHE-252',
      'CHE-253',
      'CHE-300',
      'CHE-301',
      'CHE-302',
      'CHE-303',
      'CHE-350',
      'CHE-351',
      'CHE-352',
      'CHE-353',
    ]);
  });

  it('splits theory and laboratory papers from Semester 3 onward', () => {
    expect(
      CHEMISTRY_NEHU_PAPERS.filter((paper) => paper.deliveryKind === 'THEORY'),
    ).toHaveLength(10);
    expect(
      CHEMISTRY_NEHU_PAPERS.filter(
        (paper) => paper.deliveryKind === 'PRACTICAL',
      ),
    ).toHaveLength(3);
    expect(
      CHEMISTRY_NEHU_PAPERS.find((p) => p.code === 'CHE-201'),
    ).toMatchObject({ deliveryKind: 'PRACTICAL', contactHours: 120 });
  });

  it('documents Sem 5 dual-listed minor on CHE-302', () => {
    const sem5 = CHEMISTRY_NEHU_PAPERS.find(
      (paper) => paper.code === 'CHE-302',
    );
    expect(sem5?.title).toBe('Chemistry-V');
    expect(CHEMISTRY_SEM5_MINOR_CODE).toBe('302');
    expect(CHEMISTRY_SEM5_MINOR_TITLE).toBe('General Chemistry – III');
  });

  it('documents major-minor matrix for Chemistry', () => {
    expect(CHEMISTRY_MAJOR_ALLOWED_MINORS).toEqual(['Mathematics', 'Physics']);
  });
});
