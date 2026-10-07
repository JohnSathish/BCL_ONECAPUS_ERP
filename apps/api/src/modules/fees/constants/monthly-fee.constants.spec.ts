import { applySciencePracticalLabLines } from './monthly-fee.constants';

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
