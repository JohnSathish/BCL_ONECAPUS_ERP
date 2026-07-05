import {
  BOTANY_MAJOR_ALLOWED_MINORS,
  BOTANY_NEHU_PAPERS,
  BOTANY_SEM5_MINOR_CODE,
  BOTANY_SEM5_MINOR_TITLE,
} from './botany-fyugp-nehu';

describe('botany-fyugp-nehu', () => {
  it('lists 16 NEHU Botany papers including internship BOT-303', () => {
    expect(BOTANY_NEHU_PAPERS).toHaveLength(16);
    expect(BOTANY_NEHU_PAPERS.map((paper) => paper.code)).toEqual([
      'BOT-100',
      'BOT-150',
      'BOT-200',
      'BOT-201',
      'BOT-250',
      'BOT-251',
      'BOT-252',
      'BOT-253',
      'BOT-300',
      'BOT-301',
      'BOT-302',
      'BOT-303',
      'BOT-350',
      'BOT-351',
      'BOT-352',
      'BOT-353',
    ]);
  });

  it('uses THEORY_PRACTICAL delivery for honours papers with 3+1 credits', () => {
    const honours = BOTANY_NEHU_PAPERS.filter(
      (paper) => paper.category === 'MAJOR',
    );
    for (const paper of honours) {
      expect(paper.deliveryKind).toBe('THEORY_PRACTICAL');
      expect(paper.theoryCredits).toBe(3);
      expect(paper.practicalCredits).toBe(1);
      expect(paper.contactHours).toBe(75);
    }
  });

  it('documents Sem 5 dual-listed minor on BOT-302', () => {
    const sem5 = BOTANY_NEHU_PAPERS.find((paper) => paper.code === 'BOT-302');
    expect(sem5?.title).toBe('Plant Ecology');
    expect(BOTANY_SEM5_MINOR_CODE).toBe('302');
    expect(BOTANY_SEM5_MINOR_TITLE).toContain('Angiosperm Taxonomy');
  });

  it('documents major-minor matrix for Botany', () => {
    expect(BOTANY_MAJOR_ALLOWED_MINORS).toEqual(['Zoology', 'Chemistry']);
  });
});
