import { StudentSemesterResolverService } from './student-semester-resolver.service';

describe('StudentSemesterResolverService', () => {
  const prisma = {
    studentAcademicStanding: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    studentAcademicProfile: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    campus: { findUnique: jest.fn() },
    institutionAcademicConfig: { findUnique: jest.fn() },
    admissionBatch: { findFirst: jest.fn() },
  };

  const service = new StudentSemesterResolverService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('maps alumni when programme completed', () => {
    expect(
      service.mapAcademicStatus({
        lifecycleState: 'ACTIVE',
        programmeStatus: 'COMPLETED',
        alumniEligible: false,
        lastPromotedAt: null,
      }),
    ).toBe('Alumni');
  });

  it('maps dropped when detained', () => {
    expect(
      service.mapAcademicStatus({
        lifecycleState: 'DETAINED',
        programmeStatus: 'IN_PROGRESS',
        alumniEligible: false,
        lastPromotedAt: null,
      }),
    ).toBe('Dropped');
  });

  it('maps promoted when recently promoted', () => {
    expect(
      service.mapAcademicStatus({
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
        alumniEligible: false,
        lastPromotedAt: new Date(),
      }),
    ).toBe('Promoted');
  });

  it('defaults to studying', () => {
    expect(
      service.mapAcademicStatus({
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
        alumniEligible: false,
        lastPromotedAt: null,
      }),
    ).toBe('Studying');
  });

  it('resolves semester from standing', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 3,
    });
    prisma.studentAcademicProfile.findUnique.mockResolvedValue({
      admissionBatch: {
        currentSemester: 3,
        semesterMapping: null,
        cycleType: 'ODD',
      },
    });
    prisma.student.findUnique.mockResolvedValue({ campusId: null });

    const result = await service.resolveForStudent('tenant', 'student-1');
    expect(result.semester).toBe(3);
    expect(result.batchSemester).toBe(3);
  });
});
