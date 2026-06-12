import { BadRequestException } from '@nestjs/common';

import { SubjectRegistrationEngineService } from './subject-registration-engine.service';

describe('SubjectRegistrationEngineService', () => {
  const prisma = {
    studentProgramChoice: { findMany: jest.fn(), findFirst: jest.fn() },
    offeringSection: { findFirst: jest.fn(), findMany: jest.fn() },
  };

  const engine = {
    getStructure: jest.fn(),
    updateRegistrationLines: jest.fn().mockResolvedValue({ ok: true }),
  };

  const adminRegistration = {
    buildAutoAssignLinesForStudent: jest.fn(),
  };

  const eligibility = {
    assertValidMajorMinorPair: jest.fn(),
  };

  const semesterRules = {
    resolveHonoursTrackForStudent: jest.fn().mockResolvedValue(null),
    getSemesterRule: jest.fn(),
  };

  const service = new SubjectRegistrationEngineService(
    prisma as never,
    engine as never,
    adminRegistration as never,
    eligibility as never,
    semesterRules as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('generates Sem 1 lines from major/minor paths via auto-assign engine', async () => {
    semesterRules.getSemesterRule.mockResolvedValue({
      categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1 },
    });
    prisma.studentProgramChoice.findMany.mockResolvedValue([
      { choiceType: 'MAJOR', subjectSlug: 'economics' },
      { choiceType: 'MINOR', subjectSlug: 'political-science' },
    ]);
    adminRegistration.buildAutoAssignLinesForStudent.mockResolvedValue([
      {
        category: 'MAJOR',
        offeringId: 'off-eco',
        offeringSectionId: 'sec-eco',
        registrationSource: 'ADMIN_ASSIGNED',
      },
      {
        category: 'MINOR',
        offeringId: 'off-pol',
        offeringSectionId: 'sec-pol',
        registrationSource: 'ADMIN_ASSIGNED',
      },
    ]);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-eco',
        courseOffering: { courseId: 'course-eco', course: { code: 'ECO-100' } },
      },
    ]);

    const lines = await service.generateSemesterRegistrationLines({
      tenantId: 'tenant-1',
      studentId: 'stu-1',
      programVersionId: 'pv-1',
      semesterSequence: 1,
      shiftId: 'shift-day',
      streamId: 'stream-arts',
    });

    expect(eligibility.assertValidMajorMinorPair).toHaveBeenCalledWith(
      'tenant-1',
      'economics',
      'political-science',
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.category).sort()).toEqual(['MAJOR', 'MINOR']);
  });

  it('preserves multiple unique MAJOR lines from auto-assign for Economics Sem 3', async () => {
    semesterRules.getSemesterRule.mockResolvedValue({
      categoryCounts: { MAJOR: 2, MDC: 1, AEC: 1, SEC: 1, VTC: 1 },
    });
    prisma.studentProgramChoice.findMany.mockResolvedValue([
      { choiceType: 'MAJOR', subjectSlug: 'economics' },
    ]);
    adminRegistration.buildAutoAssignLinesForStudent.mockResolvedValue([
      {
        category: 'MAJOR',
        offeringId: 'off-eco-200',
        offeringSectionId: 'sec-eco-200',
      },
      {
        category: 'MAJOR',
        offeringId: 'off-eco-201',
        offeringSectionId: 'sec-eco-201',
      },
    ]);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-eco-200',
        courseOffering: {
          courseId: 'course-eco-200',
          course: { code: 'ECO-200' },
        },
      },
      {
        id: 'sec-eco-201',
        courseOffering: {
          courseId: 'course-eco-201',
          course: { code: 'ECO-201' },
        },
      },
    ]);

    const lines = await service.generateSemesterRegistrationLines({
      tenantId: 'tenant-1',
      studentId: 'stu-1',
      programVersionId: 'pv-1',
      semesterSequence: 3,
    });

    const majorLines = lines.filter((l) => l.category === 'MAJOR');
    expect(majorLines).toHaveLength(2);
    expect(new Set(majorLines.map((l) => l.offeringId)).size).toBe(2);
  });

  it('rejects duplicate MAJOR paper assignments', async () => {
    semesterRules.getSemesterRule.mockResolvedValue({
      categoryCounts: { MAJOR: 2 },
    });
    prisma.studentProgramChoice.findMany.mockResolvedValue([
      { choiceType: 'MAJOR', subjectSlug: 'economics' },
    ]);
    adminRegistration.buildAutoAssignLinesForStudent.mockResolvedValue([
      {
        category: 'MAJOR',
        offeringId: 'off-eco-200',
        offeringSectionId: 'sec-eco-200',
      },
      {
        category: 'MAJOR',
        offeringId: 'off-eco-200',
        offeringSectionId: 'sec-eco-200-b',
      },
    ]);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-eco-200',
        courseOffering: {
          courseId: 'course-eco-200',
          course: { code: 'ECO-200' },
        },
      },
      {
        id: 'sec-eco-200-b',
        courseOffering: {
          courseId: 'course-eco-200',
          course: { code: 'ECO-200' },
        },
      },
    ]);

    await expect(
      service.generateSemesterRegistrationLines({
        tenantId: 'tenant-1',
        studentId: 'stu-1',
        programVersionId: 'pv-1',
        semesterSequence: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps buildAdmitRegistrationLines to MAJOR-1 and MAJOR-2 slot order', async () => {
    semesterRules.getSemesterRule.mockResolvedValue({
      categoryCounts: { MAJOR: 2, MDC: 1 },
    });
    prisma.studentProgramChoice.findMany.mockResolvedValue([
      { choiceType: 'MAJOR', subjectSlug: 'economics' },
    ]);
    adminRegistration.buildAutoAssignLinesForStudent.mockResolvedValue([
      {
        category: 'MAJOR',
        offeringId: 'off-eco-200',
        offeringSectionId: 'sec-eco-200',
      },
      {
        category: 'MAJOR',
        offeringId: 'off-eco-201',
        offeringSectionId: 'sec-eco-201',
      },
      {
        category: 'MDC',
        offeringId: 'off-mdc',
        offeringSectionId: 'sec-mdc',
      },
    ]);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-eco-200',
        courseOffering: {
          courseId: 'course-eco-200',
          course: { code: 'ECO-200' },
        },
      },
      {
        id: 'sec-eco-201',
        courseOffering: {
          courseId: 'course-eco-201',
          course: { code: 'ECO-201' },
        },
      },
    ]);

    const lines = await service.buildAdmitRegistrationLines({
      tenantId: 'tenant-1',
      studentId: 'stu-1',
      programVersionId: 'pv-1',
      semesterSequence: 3,
      subjectSelections: {
        'MAJOR-1': 'sec-eco-200',
        'MAJOR-2': 'sec-eco-201',
      },
    });

    const majorOfferings = lines
      .filter((l) => l.category === 'MAJOR')
      .map((l) => l.offeringId);
    expect(majorOfferings).toEqual(['off-eco-200', 'off-eco-201']);
  });

  it('passes generatedBy AUTO_ENGINE when applying lines', async () => {
    await service.applyGeneratedLines(
      'tenant-1',
      'reg-1',
      [{ category: 'MAJOR', offeringId: 'off-1', offeringSectionId: 'sec-1' }],
      { assignedById: 'admin-1' },
    );

    expect(engine.updateRegistrationLines).toHaveBeenCalledWith(
      'tenant-1',
      'reg-1',
      expect.any(Array),
      expect.objectContaining({
        generatedBy: 'AUTO_ENGINE',
        assignedById: 'admin-1',
      }),
    );
  });
});
