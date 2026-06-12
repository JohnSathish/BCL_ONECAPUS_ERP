import { CourseImportHandler } from './course-import.handler';

describe('CourseImportHandler', () => {
  const prisma = {
    department: { findMany: jest.fn() },
    course: { findMany: jest.fn() },
    tenantAcademicSettings: { findUnique: jest.fn() },
  };

  const handler = new CourseImportHandler(prisma as never);

  const baseRow = {
    courseType: 'CORE',
    departmentCode: 'ENG',
    totalTheoryContactHours: 45,
    totalPracticalContactHours: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.department.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', code: 'ENG', departmentType: 'ARTS' },
    ]);
    (prisma.course.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.tenantAcademicSettings.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
  });

  it('rejects duplicate code in file', async () => {
    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'ENG-100',
          courseTitle: 'A',
          deliveryType: 'THEORY',
          theoryCredits: 3,
          practicalCredits: 0,
          theoryHoursPerWeek: 3,
          practicalHoursPerWeek: 0,
          ...baseRow,
        },
      },
      {
        rowNumber: 3,
        raw: {
          courseCode: 'ENG-100',
          courseTitle: 'B',
          deliveryType: 'THEORY',
          theoryCredits: 3,
          practicalCredits: 0,
          theoryHoursPerWeek: 3,
          practicalHoursPerWeek: 0,
          ...baseRow,
        },
      },
    ]);
    expect(
      results[1]?.errors.some((e) => e.includes('within uploaded file')),
    ).toBe(true);
  });

  it('rejects invalid department', async () => {
    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'PHY-101',
          courseTitle: 'Physics',
          deliveryType: 'THEORY',
          theoryCredits: 3,
          practicalCredits: 0,
          theoryHoursPerWeek: 3,
          practicalHoursPerWeek: 0,
          courseType: 'CORE',
          departmentCode: 'PHY',
          totalTheoryContactHours: 45,
          totalPracticalContactHours: 0,
        },
      },
    ]);
    expect(results[0]?.status).toBe('INVALID');
    expect(results[0]?.errors[0]).toContain('Invalid department code');
  });

  it('rejects administrative department code', async () => {
    (prisma.department.findMany as jest.Mock).mockResolvedValue([
      { id: 'd1', code: 'ENG', departmentType: 'ARTS' },
      { id: 'd2', code: 'ADM', departmentType: 'ADMINISTRATIVE' },
    ]);

    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'ADM-101',
          courseTitle: 'Admin Course',
          deliveryType: 'THEORY',
          theoryCredits: 3,
          practicalCredits: 0,
          theoryHoursPerWeek: 3,
          practicalHoursPerWeek: 0,
          courseType: 'CORE',
          departmentCode: 'ADM',
          totalTheoryContactHours: 45,
          totalPracticalContactHours: 0,
        },
      },
    ]);
    expect(results[0]?.status).toBe('INVALID');
    expect(results[0]?.errors[0]).toContain('administrative');
  });

  it('accepts GEO-252 practical-only row', async () => {
    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'GEO-252',
          courseTitle: 'Statistical Techniques in Geography',
          deliveryType: 'PRACTICAL',
          theoryCredits: 0,
          practicalCredits: 4,
          theoryHoursPerWeek: 0,
          practicalHoursPerWeek: 6,
          totalTheoryContactHours: 0,
          totalPracticalContactHours: 120,
          courseType: 'CORE',
          departmentCode: 'ENG',
        },
      },
    ]);
    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.theoryCredits).toBe(0);
    expect(results[0]?.normalized?.practicalCredits).toBe(4);
    expect(results[0]?.normalized?.credits).toBe(4);
    expect(results[0]?.normalized?.hasPractical).toBe(true);
  });

  it('rejects theory weekly hours when theory credits are zero', async () => {
    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'GEO-252',
          courseTitle: 'Practical Lab',
          deliveryType: 'PRACTICAL',
          theoryCredits: 0,
          practicalCredits: 4,
          theoryHoursPerWeek: 3,
          practicalHoursPerWeek: 6,
          totalTheoryContactHours: 0,
          totalPracticalContactHours: 120,
          courseType: 'CORE',
          departmentCode: 'ENG',
        },
      },
    ]);
    expect(results[0]?.status).toBe('INVALID');
    expect(
      results[0]?.errors.some((e) =>
        e.includes('Weekly theory hours must be 0'),
      ),
    ).toBe(true);
  });

  it('accepts Sub 303 internship import row', async () => {
    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'SUB-303',
          courseTitle: 'Internship',
          deliveryType: 'INTERNSHIP',
          totalCredits: 4,
          theoryCredits: 0,
          practicalCredits: 0,
          courseType: 'CORE',
          departmentCode: 'ENG',
          totalContactHours: 120,
        },
      },
    ]);
    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.credits).toBe(4);
    expect(results[0]?.normalized?.theoryCredits).toBe(0);
    expect(results[0]?.normalized?.practicalCredits).toBe(0);
    expect(results[0]?.normalized?.totalContactHours).toBe(120);
    expect(results[0]?.normalized?.creditCalculationMode).toBe(
      'MANUAL_OVERRIDE',
    );
    expect(results[0]?.normalized?.hasPractical).toBe(false);
  });

  it('normalizes FIELDWORK delivery alias', async () => {
    const results = await handler.parseAndValidate('t1', [
      {
        rowNumber: 2,
        raw: {
          courseCode: 'FW-101',
          courseTitle: 'Field',
          deliveryType: 'FIELDWORK',
          totalCredits: 2,
          theoryCredits: 0,
          practicalCredits: 0,
          totalContactHours: 30,
          courseType: 'CORE',
          departmentCode: 'ENG',
        },
      },
    ]);
    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.deliveryType).toBe('FIELD_WORK');
    expect(results[0]?.normalized?.totalContactHours).toBe(30);
  });
});
