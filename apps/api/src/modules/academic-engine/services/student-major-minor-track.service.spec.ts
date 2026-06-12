import { ConflictException } from '@nestjs/common';
import { StudentMajorMinorTrackService } from './student-major-minor-track.service';

describe('StudentMajorMinorTrackService', () => {
  const prisma = {
    studentAcademicStanding: { findUnique: jest.fn() },
    studentMajorMinorTrack: { findFirst: jest.fn() },
    studentProgramChoice: { findMany: jest.fn() },
    student: { findFirst: jest.fn() },
    academicSubject: { findFirst: jest.fn() },
  };

  const service = new StudentMajorMinorTrackService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows major/minor changes in semester 1 when unlocked', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 1,
    });
    prisma.studentMajorMinorTrack.findFirst.mockResolvedValue({
      isTrackLocked: false,
    });

    await expect(
      service.assertCanChangeMajorMinor('tenant-1', 'student-1'),
    ).resolves.toBeUndefined();
  });

  it('blocks major/minor changes when track is locked', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 3,
    });
    prisma.studentMajorMinorTrack.findFirst.mockResolvedValue({
      isTrackLocked: true,
    });

    await expect(
      service.assertCanChangeMajorMinor('tenant-1', 'student-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks major/minor changes from semester 2 even if unlock flag false', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 2,
    });
    prisma.studentMajorMinorTrack.findFirst.mockResolvedValue({
      isTrackLocked: false,
    });

    const allowed = await service.canChangeMajorMinor('tenant-1', 'student-1');
    expect(allowed).toBe(false);
  });
});
