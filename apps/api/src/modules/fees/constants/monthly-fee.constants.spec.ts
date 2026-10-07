import {
  applySciencePracticalLabLines,
  isBillableScienceLabCourse,
  scienceHonoursIncludesLab,
} from './monthly-fee.constants';

const scienceLines = [
  { code: 'TUITION', amount: 100 },
  { code: 'COLLEGE_FEE', amount: 900 },
  { code: 'LAB_FEE', amount: 450 },
  { code: 'LAB_EXPENDABLES', amount: 350 },
];

describe('applySciencePracticalLabLines', () => {
  it('keeps the lab package once when the student has a practical subject', () => {
    const lines = applySciencePracticalLabLines(scienceLines, 1);
    expect(lines.map((line) => line.code)).toEqual([
      'TUITION',
      'COLLEGE_FEE',
      'LAB_FEE',
      'LAB_EXPENDABLES',
    ]);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(1800);
  });

  it('does not multiply the lab package by the number of practical subjects', () => {
    const lines = applySciencePracticalLabLines(scienceLines, 3);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(1800);
  });

  it('drops lab lines when the student has no practical subject', () => {
    const lines = applySciencePracticalLabLines(scienceLines, 0);
    expect(lines.map((line) => line.code)).toEqual(['TUITION', 'COLLEGE_FEE']);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(1000);
  });
});

describe('science lab eligibility', () => {
  it('always includes lab for Botany, Chemistry, and Zoology honours', () => {
    expect(scienceHonoursIncludesLab({ programCode: 'BSC-BOT' })).toBe(true);
    expect(scienceHonoursIncludesLab({ programCode: 'BSC-CHE' })).toBe(true);
    expect(scienceHonoursIncludesLab({ majorSlug: 'zoology' })).toBe(true);
  });

  it('does not give Mathematics or Physics the lab package from honours alone', () => {
    expect(scienceHonoursIncludesLab({ programCode: 'BSC-MTH' })).toBe(false);
    expect(scienceHonoursIncludesLab({ programCode: 'BSC-PHY' })).toBe(false);
    expect(scienceHonoursIncludesLab({ majorSlug: 'mathematics' })).toBe(false);
  });

  it('counts a practical paper and ignores internship', () => {
    expect(
      isBillableScienceLabCourse({
        hasPractical: true,
        deliveryType: 'THEORY_PRACTICAL',
      }),
    ).toBe(true);
    expect(
      isBillableScienceLabCourse({
        hasPractical: true,
        deliveryType: 'INTERNSHIP',
        practicalCredits: 4,
      }),
    ).toBe(false);
    expect(
      isBillableScienceLabCourse({
        hasPractical: false,
        deliveryType: 'THEORY',
        practicalCredits: 0,
      }),
    ).toBe(false);
  });
});
