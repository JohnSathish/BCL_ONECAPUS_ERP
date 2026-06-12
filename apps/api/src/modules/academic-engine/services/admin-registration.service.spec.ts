import { BadRequestException } from '@nestjs/common';

import { AdminRegistrationService } from './admin-registration.service';

describe('AdminRegistrationService buildAutoAssignLines', () => {
  const prisma = {
    student: { findFirstOrThrow: jest.fn() },
    semesterStructureRule: { findFirst: jest.fn() },
    semesterRegistration: { findFirst: jest.fn() },
    semester: { findFirst: jest.fn() },
    offeringSection: { findMany: jest.fn() },
  };
  const engine = { getStructure: jest.fn() };
  const sectionStreams = {
    eligibleStreamIdsFromSection: jest.fn().mockReturnValue([]),
  };
  const workflow = {
    getForStudent: jest
      .fn()
      .mockResolvedValue({ studentElectiveCategories: [] }),
  };
  const curriculum = {
    resolveCatalogSectionWhere: jest.fn().mockResolvedValue({}),
    filterSectionsByPoolExclusions: jest
      .fn()
      .mockImplementation((_t, _p, rows) => rows),
  };
  const majorMinorTrack = { syncFromProgramChoices: jest.fn() };
  const vtcTrack = {
    filterVtcSectionsSync: jest
      .fn()
      .mockImplementation((_t, _s, _sem, rows) => rows),
  };
  const courseEligibility = {
    buildContextFromStudent: jest.fn().mockResolvedValue({
      class12Subjects: [],
      completedStudy: [],
    }),
    filterSections: jest.fn().mockImplementation((_rows) => _rows),
  };

  const service = new AdminRegistrationService(
    prisma as never,
    engine as never,
    sectionStreams as never,
    workflow as never,
    curriculum as never,
    majorMinorTrack as never,
    vtcTrack as never,
    courseEligibility as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('assigns Economics Sem 3 ECO-200 and ECO-201 to distinct MAJOR slots', async () => {
    prisma.student.findFirstOrThrow.mockResolvedValue({
      programVersionId: 'pv-eco',
      primaryShiftId: 'shift-day',
      academicProfile: {
        streamId: null,
        preferredShiftId: 'shift-day',
        class12Subjects: [],
      },
      programChoices: [{ choiceType: 'MAJOR', subjectSlug: 'economics' }],
    });
    prisma.semesterStructureRule.findFirst.mockResolvedValue({
      categoryCounts: { MAJOR: 2, MDC: 1, AEC: 1, SEC: 1, VTC: 1 },
      continuityRules: { MAJOR: 'LOCK' },
      lines: [],
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-eco-200',
        courseOfferingId: 'off-eco-200',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MAJOR',
          majorPaperIndex: null,
          displayOrder: null,
          courseId: 'course-eco-200',
          course: {
            code: 'ECO-200',
            title: 'Economics of Growth and Development',
            subjectSlug: 'economics',
          },
        },
      },
      {
        id: 'sec-eco-201',
        courseOfferingId: 'off-eco-201',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MAJOR',
          majorPaperIndex: null,
          displayOrder: null,
          courseId: 'course-eco-201',
          course: {
            code: 'ECO-201',
            title: 'Mathematical Methods for Economics - I',
            subjectSlug: 'economics',
          },
        },
      },
    ]);

    const lines = await service.buildAutoAssignLinesForStudent(
      'tenant-1',
      'stu-1',
      'pv-eco',
      3,
      { shiftId: 'shift-day' },
    );

    const majorLines = lines.filter((l) => l.category === 'MAJOR');
    expect(majorLines).toHaveLength(2);
    expect(new Set(majorLines.map((l) => l.offeringId)).size).toBe(2);
    expect(majorLines[0]?.offeringId).toBe('off-eco-200');
    expect(majorLines[1]?.offeringId).toBe('off-eco-201');
  });

  it('throws when fewer unique MAJOR papers exist than required', async () => {
    prisma.student.findFirstOrThrow.mockResolvedValue({
      programVersionId: 'pv-eco',
      primaryShiftId: 'shift-day',
      academicProfile: {
        streamId: null,
        preferredShiftId: 'shift-day',
        class12Subjects: [],
      },
      programChoices: [{ choiceType: 'MAJOR', subjectSlug: 'economics' }],
    });
    prisma.semesterStructureRule.findFirst.mockResolvedValue({
      categoryCounts: { MAJOR: 2 },
      continuityRules: {},
      lines: [],
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-eco-200',
        courseOfferingId: 'off-eco-200',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MAJOR',
          majorPaperIndex: null,
          displayOrder: null,
          courseId: 'course-eco-200',
          course: {
            code: 'ECO-200',
            title: 'Economics',
            subjectSlug: 'economics',
          },
        },
      },
    ]);

    await expect(
      service.buildAutoAssignLinesForStudent('tenant-1', 'stu-1', 'pv-eco', 3),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns INTERNSHIP for semester 5 FYUGP structure', async () => {
    prisma.student.findFirstOrThrow.mockResolvedValue({
      programVersionId: 'pv-edu',
      primaryShiftId: 'shift-day',
      academicProfile: {
        streamId: null,
        preferredShiftId: 'shift-day',
        class12Subjects: [],
      },
      programChoices: [
        { choiceType: 'MAJOR', subjectSlug: 'education' },
        { choiceType: 'MINOR', subjectSlug: 'education' },
      ],
    });
    prisma.semesterStructureRule.findFirst.mockResolvedValue({
      categoryCounts: { MAJOR: 3, MINOR: 1, INTERNSHIP: 1 },
      continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
      lines: [],
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-edn-300',
        courseOfferingId: 'off-edn-300',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MAJOR',
          majorPaperIndex: 1,
          displayOrder: 1,
          courseId: 'course-edn-300',
          course: {
            code: 'EDN-300',
            title: 'Educational Management',
            subjectSlug: 'education',
          },
        },
      },
      {
        id: 'sec-edn-301',
        courseOfferingId: 'off-edn-301',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MAJOR',
          majorPaperIndex: 2,
          displayOrder: 2,
          courseId: 'course-edn-301',
          course: {
            code: 'EDN-301',
            title: 'Curriculum Development',
            subjectSlug: 'education',
          },
        },
      },
      {
        id: 'sec-edn-302',
        courseOfferingId: 'off-edn-302',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MAJOR',
          majorPaperIndex: 3,
          displayOrder: 3,
          courseId: 'course-edn-302',
          course: {
            code: 'EDN-302',
            title: 'Educational Psychology',
            subjectSlug: 'education',
          },
        },
      },
      {
        id: 'sec-edn-303',
        courseOfferingId: 'off-edn-303',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'MINOR',
          majorPaperIndex: null,
          displayOrder: null,
          courseId: 'course-edn-303',
          course: {
            code: 'EDN-303',
            title: 'Minor Paper',
            subjectSlug: 'education',
          },
        },
      },
      {
        id: 'sec-edn-304',
        courseOfferingId: 'off-edn-304',
        capacity: 80,
        seatLedger: { confirmedCount: 0 },
        courseOffering: {
          category: 'INTERNSHIP',
          majorPaperIndex: null,
          displayOrder: null,
          courseId: 'course-edn-304',
          course: {
            code: 'EDN-304',
            title: 'Internship',
            subjectSlug: 'education',
          },
        },
      },
    ]);

    const lines = await service.buildAutoAssignLinesForStudent(
      'tenant-1',
      'stu-1',
      'pv-edu',
      5,
      { shiftId: 'shift-day' },
    );

    expect(lines.find((l) => l.category === 'INTERNSHIP')?.offeringId).toBe(
      'off-edn-304',
    );
    expect(lines.filter((l) => l.category === 'MAJOR')).toHaveLength(3);
    expect(lines.filter((l) => l.category === 'MINOR')).toHaveLength(1);
  });
});
