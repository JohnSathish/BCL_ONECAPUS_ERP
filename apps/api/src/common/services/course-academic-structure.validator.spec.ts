import { BadRequestException } from '@nestjs/common';
import { validateCourseAcademicStructure } from './course-academic-structure.validator';

describe('validateCourseAcademicStructure', () => {
  it('accepts theory-only course', () => {
    expect(() =>
      validateCourseAcademicStructure({
        theoryCredits: 4,
        practicalCredits: 0,
        theoryHoursPerWeek: 4,
        practicalHoursPerWeek: 0,
        totalTheoryContactHours: 60,
        totalPracticalContactHours: 0,
      }),
    ).not.toThrow();
  });

  it('accepts GEO-252 practical-only pattern', () => {
    expect(() =>
      validateCourseAcademicStructure({
        deliveryType: 'PRACTICAL',
        theoryCredits: 0,
        practicalCredits: 4,
        theoryHoursPerWeek: 0,
        practicalHoursPerWeek: 6,
        totalTheoryContactHours: 0,
        totalPracticalContactHours: 120,
      }),
    ).not.toThrow();
  });

  it('accepts mixed course', () => {
    expect(() =>
      validateCourseAcademicStructure({
        deliveryType: 'THEORY_PRACTICAL',
        theoryCredits: 1,
        practicalCredits: 3,
        theoryHoursPerWeek: 1,
        practicalHoursPerWeek: 3,
        totalTheoryContactHours: 30,
        totalPracticalContactHours: 75,
      }),
    ).not.toThrow();
  });

  it('rejects theory delivery without theory credits', () => {
    expect(() =>
      validateCourseAcademicStructure({
        deliveryType: 'THEORY',
        theoryCredits: 0,
        practicalCredits: 4,
        theoryHoursPerWeek: 0,
        practicalHoursPerWeek: 6,
        totalTheoryContactHours: 0,
        totalPracticalContactHours: 120,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects zero total credits (auto mode)', () => {
    expect(() =>
      validateCourseAcademicStructure({
        theoryCredits: 0,
        practicalCredits: 0,
        theoryHoursPerWeek: 0,
        practicalHoursPerWeek: 0,
        totalTheoryContactHours: 0,
        totalPracticalContactHours: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts Sub 303 internship pattern (manual override)', () => {
    expect(() =>
      validateCourseAcademicStructure({
        deliveryType: 'INTERNSHIP',
        creditCalculationMode: 'MANUAL_OVERRIDE',
        credits: 4,
        theoryCredits: 0,
        practicalCredits: 0,
        theoryHoursPerWeek: 0,
        practicalHoursPerWeek: 0,
        totalTheoryContactHours: 0,
        totalPracticalContactHours: 0,
        totalContactHours: 120,
      }),
    ).not.toThrow();
  });

  it('rejects weekly theory hours when theory credits are zero', () => {
    expect(() =>
      validateCourseAcademicStructure({
        theoryCredits: 0,
        practicalCredits: 4,
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 6,
        totalTheoryContactHours: 0,
        totalPracticalContactHours: 120,
      }),
    ).toThrow(BadRequestException);
  });

  it('requires practical contact hours when practical credits are set', () => {
    expect(() =>
      validateCourseAcademicStructure({
        theoryCredits: 0,
        practicalCredits: 4,
        theoryHoursPerWeek: 0,
        practicalHoursPerWeek: 6,
        totalTheoryContactHours: 0,
        totalPracticalContactHours: 0,
      }),
    ).toThrow(BadRequestException);
  });
});
