import { RegistrationImportHandler } from './registration-import.handler';
import { isNepCategory } from '../domain/nep-categories';

describe('RegistrationImportHandler', () => {
  const prisma = {
    semester: { findFirst: jest.fn() },
    student: { findMany: jest.fn() },
    courseOffering: { findMany: jest.fn() },
    semesterStructureRule: { findMany: jest.fn() },
    semesterRegistration: { findFirst: jest.fn() },
  };

  const engine = {
    createRegistration: jest.fn(),
    updateRegistrationLines: jest.fn(),
    validateRegistration: jest.fn(),
    submitRegistration: jest.fn(),
  };

  const adminRegistration = {
    setRegistrationFrozen: jest.fn(),
  };

  const curriculum = {
    resolveProgrammeCurriculum: jest.fn().mockResolvedValue({
      inheritedPoolOfferings: [],
    }),
  };

  const lifecycle = {
    resolveOperationalSemester: jest.fn(),
  };

  const handler = new RegistrationImportHandler(
    prisma as never,
    engine as never,
    adminRegistration as never,
    curriculum as never,
    lifecycle as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.semester.findFirst.mockResolvedValue({
      id: 'sem-1',
      semesterNumber: 1,
    });
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'stu-1',
        enrollmentNumber: 'REG001',
        programVersionId: 'pv-1',
        primaryShiftId: 'shift-1',
        academicProfile: { preferredShiftId: 'shift-1', streamId: 'stream-1' },
        academicStanding: {
          currentSemesterSequence: 1,
          registrationLocked: false,
        },
      },
    ]);
    prisma.courseOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        category: 'MAJOR',
        majorPaperIndex: null,
        semesterSequence: 1,
        programVersionId: 'pv-1',
        course: { code: 'BCA-M101' },
        sections: [{ id: 'sec-1', sectionCode: 'A', shiftId: 'shift-1' }],
      },
    ]);
    prisma.semesterStructureRule.findMany.mockResolvedValue([
      {
        programVersionId: 'pv-1',
        semesterSequence: 1,
        categoryCounts: { MAJOR: 1 },
      },
    ]);
  });

  it('validates a correct registration row', async () => {
    const results = await handler.parseAndValidate(
      'tenant',
      [
        {
          rowNumber: 2,
          raw: {
            registrationNumber: 'REG001',
            category: 'MAJOR',
            courseCode: 'BCA-M101',
            sectionCode: 'A',
          },
        },
      ],
      { semesterId: 'sem-1', semesterSequence: 1 },
    );

    expect(results[0]?.status).toBe('VALID');
    expect(results[0]?.normalized?.offeringSectionId).toBe('sec-1');
  });

  it('rejects unknown student', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    const results = await handler.parseAndValidate(
      'tenant',
      [
        {
          rowNumber: 2,
          raw: {
            registrationNumber: 'MISSING',
            category: 'MAJOR',
            courseCode: 'BCA-M101',
          },
        },
      ],
      { semesterId: 'sem-1', semesterSequence: 1 },
    );
    expect(results[0]?.status).toBe('INVALID');
    expect(results[0]?.errors.some((e) => e.includes('not found'))).toBe(true);
  });

  it('accepts NEP categories', () => {
    expect(isNepCategory('VTC')).toBe(true);
    expect(isNepCategory('INVALID')).toBe(false);
  });
});
