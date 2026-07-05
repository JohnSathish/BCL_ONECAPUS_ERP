import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { slugifySubject } from '../domain/nep-categories';

const trackInclude = {
  majorSubject: { select: { id: true, slug: true, name: true } },
  minorSubject: { select: { id: true, slug: true, name: true } },
} as const;

@Injectable()
export class StudentMajorMinorTrackService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrack(tenantId: string, studentId: string) {
    return this.prisma.studentMajorMinorTrack.findFirst({
      where: { tenantId, studentId },
      include: trackInclude,
    });
  }

  async canChangeMajorMinor(
    tenantId: string,
    studentId: string,
  ): Promise<boolean> {
    const [standing, track] = await Promise.all([
      this.prisma.studentAcademicStanding.findUnique({
        where: { studentId },
        select: { currentSemesterSequence: true },
      }),
      this.getTrack(tenantId, studentId),
    ]);
    if (track?.isTrackLocked) return false;
    const sem = standing?.currentSemesterSequence ?? 1;
    return sem <= 1;
  }

  async assertCanChangeMajorMinor(tenantId: string, studentId: string) {
    const allowed = await this.canChangeMajorMinor(tenantId, studentId);
    if (!allowed) {
      throw new ConflictException(
        'Major/Minor track locked after Semester 1 promotion.',
      );
    }
  }

  async syncFromProgramChoices(tenantId: string, studentId: string) {
    const choices = await this.prisma.studentProgramChoice.findMany({
      where: { tenantId, studentId, status: 'active', deletedAt: null },
    });
    const majorSlug = choices.find(
      (c) => c.choiceType === 'MAJOR',
    )?.subjectSlug;
    if (!majorSlug) return null;

    const minorSlug = choices.find(
      (c) => c.choiceType === 'MINOR',
    )?.subjectSlug;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        programVersion: {
          select: {
            program: {
              select: { department: { select: { institutionId: true } } },
            },
          },
        },
      },
    });
    const institutionId =
      student?.programVersion?.program?.department?.institutionId;
    if (!institutionId) {
      throw new BadRequestException(
        'Student institution not resolved for track sync',
      );
    }

    const majorSubject = await this.resolveSubject(
      tenantId,
      institutionId,
      majorSlug,
    );
    const minorSubject = minorSlug
      ? await this.resolveSubject(tenantId, institutionId, minorSlug)
      : null;

    return this.prisma.studentMajorMinorTrack.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        majorSubjectId: majorSubject.id,
        minorSubjectId: minorSubject?.id ?? null,
      },
      update: {
        majorSubjectId: majorSubject.id,
        minorSubjectId: minorSubject?.id ?? null,
      },
      include: trackInclude,
    });
  }

  /**
   * After student import or bootstrap — populate major/minor track from
   * program choices, then programme name, then department.
   */
  async ensureTrackAfterImport(tenantId: string, studentId: string) {
    const existing = await this.getTrack(tenantId, studentId);
    if (existing?.isTrackLocked) return existing;

    try {
      const synced = await this.syncFromProgramChoices(tenantId, studentId);
      if (synced) return synced;
    } catch {
      // Fall through to programme / department resolution.
    }

    return this.syncFromProgrammeOrDepartment(tenantId, studentId);
  }

  private async syncFromProgrammeOrDepartment(
    tenantId: string,
    studentId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: {
        departmentId: true,
        programVersion: {
          select: {
            program: {
              select: {
                name: true,
                department: { select: { institutionId: true } },
              },
            },
          },
        },
        department: { select: { institutionId: true } },
      },
    });
    if (!student) return null;

    const institutionId =
      student.programVersion?.program?.department?.institutionId ??
      student.department?.institutionId ??
      (
        await this.prisma.institution.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      )?.id;
    if (!institutionId) return null;

    const programmeName = student.programVersion?.program?.name;
    if (programmeName) {
      const match = programmeName.match(/^FYUP in\s+(.+)$/i);
      if (match?.[1]) {
        const subject = await this.prisma.academicSubject.findFirst({
          where: {
            tenantId,
            institutionId,
            slug: slugifySubject(match[1].trim()),
            deletedAt: null,
            isActive: true,
          },
        });
        if (subject) {
          return this.upsertTrack(tenantId, studentId, subject.id, null);
        }
      }
    }

    if (student.departmentId) {
      const subject = await this.prisma.academicSubject.findFirst({
        where: {
          tenantId,
          institutionId,
          departmentId: student.departmentId,
          deletedAt: null,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      if (subject) {
        return this.upsertTrack(tenantId, studentId, subject.id, null);
      }
    }

    return null;
  }

  private upsertTrack(
    tenantId: string,
    studentId: string,
    majorSubjectId: string,
    minorSubjectId: string | null,
  ) {
    return this.prisma.studentMajorMinorTrack.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        majorSubjectId,
        minorSubjectId,
      },
      update: {
        majorSubjectId,
        minorSubjectId,
      },
      include: trackInclude,
    });
  }

  async lockOnPromotion(
    tenantId: string,
    studentId: string,
    toSequence: number,
    promotionRunId?: string,
  ) {
    if (toSequence < 2) return;
    const existing = await this.getTrack(tenantId, studentId);
    if (!existing) {
      await this.syncFromProgramChoices(tenantId, studentId);
    }
    await this.prisma.studentMajorMinorTrack.updateMany({
      where: { tenantId, studentId, isTrackLocked: false },
      data: {
        isTrackLocked: true,
        lockedAtSemester: 2,
        lockedAt: new Date(),
        lockedByPromotionRunId: promotionRunId ?? null,
      },
    });
  }

  async unlockTrack(
    tenantId: string,
    studentId: string,
    userId: string,
    reason: string,
  ) {
    const track = await this.getTrack(tenantId, studentId);
    if (!track) throw new NotFoundException('Major/minor track not found');
    return this.prisma.studentMajorMinorTrack.update({
      where: { id: track.id },
      data: {
        isTrackLocked: false,
        unlockReason: reason.trim(),
        unlockedAt: new Date(),
        unlockedById: userId,
      },
      include: trackInclude,
    });
  }

  private async resolveSubject(
    tenantId: string,
    institutionId: string,
    slug: string,
  ) {
    const normalized = slugifySubject(slug);
    const subject = await this.prisma.academicSubject.findFirst({
      where: {
        tenantId,
        institutionId,
        slug: normalized,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!subject) {
      throw new BadRequestException(
        `Academic subject not found for slug "${normalized}"`,
      );
    }
    return subject;
  }
}
