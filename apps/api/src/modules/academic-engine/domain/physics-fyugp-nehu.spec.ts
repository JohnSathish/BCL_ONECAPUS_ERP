import {
  PHYSICS_MAJOR_ALLOWED_MINORS,
  PHYSICS_NEHU_PAPERS,
  PHYSICS_SEM5_MINOR_CODE,
  PHYSICS_SEM5_MINOR_TITLE,
} from './physics-fyugp-nehu';

describe('physics-fyugp-nehu', () => {
  it('lists 16 NEHU Physics papers including internship PHY-303', () => {
    expect(PHYSICS_NEHU_PAPERS).toHaveLength(16);
    expect(PHYSICS_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'PHY-100',
      'PHY-150',
      'PHY-200',
      'PHY-201',
      'PHY-250',
      'PHY-251',
      'PHY-252',
      'PHY-253',
      'PHY-300',
      'PHY-301',
      'PHY-302',
      'PHY-303',
      'PHY-350',
      'PHY-351',
      'PHY-352',
      'PHY-353',
    ]);
  });

  it('uses four distinct Sem 4 and Sem 6 major codes with lab papers', () => {
    const sem4 = PHYSICS_NEHU_PAPERS.filter(
      (paper) => paper.semester === 4 && paper.category === 'MAJOR',
    );
    expect(sem4).toHaveLength(4);
    expect(sem4.find((p) => p.code === 'PHY-253')?.deliveryKind).toBe(
      'PRACTICAL',
    );

    const sem6 = PHYSICS_NEHU_PAPERS.filter(
      (paper) => paper.semester === 6 && paper.category === 'MAJOR',
    );
    expect(sem6).toHaveLength(4);
    expect(sem6.find((p) => p.code === 'PHY-353')?.deliveryKind).toBe(
      'PRACTICAL',
    );
  });

  it('has theory-only Sem 5 majors per NEHU internship note', () => {
    const sem5Majors = PHYSICS_NEHU_PAPERS.filter(
      (paper) => paper.semester === 5 && paper.category === 'MAJOR',
    );
    expect(sem5Majors).toHaveLength(3);
    expect(sem5Majors.every((p) => p.deliveryKind === 'THEORY')).toBe(true);
  });

  it('documents Sem 5 dual-listed minor on PHY-302', () => {
    expect(
      PHYSICS_NEHU_PAPERS.find((paper) => paper.code === 'PHY-302')?.title,
    ).toBe('Thermal and Statistical Physics');
    expect(PHYSICS_SEM5_MINOR_CODE).toBe('302');
    expect(PHYSICS_SEM5_MINOR_TITLE).toBe('Modern Physics I');
  });

  it('documents major-minor matrix for Physics', () => {
    expect(PHYSICS_MAJOR_ALLOWED_MINORS).toEqual(['Chemistry', 'Mathematics']);
  });
});
