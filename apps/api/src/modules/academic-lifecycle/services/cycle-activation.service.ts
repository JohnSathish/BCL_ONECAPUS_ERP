import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  cycleTypeFromSemesterNumber,
  type AcademicCycle,
  semesterNumbersForCycle,
} from '../utils/cycle.util';
import type { ActivateCycleDto } from '../dto/academic-lifecycle.dto';

const ACTIVE_FLAGS = {
  isActive: true,
  status: 'ACTIVE',
  registrationOpen: true,
  attendanceEnabled: true,
  examinationEnabled: true,
  timetableEnabled: true,
  feeCycleEnabled: true,
  resultProcessingEnabled: true,
} as const;

const INACTIVE_FLAGS = {
  isActive: false,
  status: 'PLANNED',
  registrationOpen: false,
  attendanceEnabled: false,
  examinationEnabled: false,
  timetableEnabled: false,
  feeCycleEnabled: false,
  resultProcessingEnabled: false,
} as const;

@Injectable()
export class CycleActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async activateOddCycle(
    tenantId: string,
    institutionId: string,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    return this.activateCycle(tenantId, institutionId, 'ODD', dto, actorId);
  }

  async activateEvenCycle(
    tenantId: string,
    institutionId: string,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    return this.activateCycle(tenantId, institutionId, 'EVEN', dto, actorId);
  }

  private async activateCycle(
    tenantId: string,
    institutionId: string,
    cycle: AcademicCycle,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    const numbers = semesterNumbersForCycle(cycle);
    const opposite = cycle === 'ODD' ? 'EVEN' : 'ODD';
    const oppositeNumbers = semesterNumbersForCycle(opposite);

    await this.prisma.$transaction(async (tx) => {
      await tx.semester.updateMany({
        where: {
          tenantId,
          institutionId,
          deletedAt: null,
          semesterNumber: { in: oppositeNumbers },
          status: { not: 'FROZEN' },
        },
        data: INACTIVE_FLAGS,
      });

      await tx.semester.updateMany({
        where: {
          tenantId,
          institutionId,
          deletedAt: null,
          semesterNumber: { in: numbers },
          status: { not: 'FROZEN' },
        },
        data: ACTIVE_FLAGS,
      });

      if (dto.campusId && dto.shiftId) {
        const activeSemesters = await tx.semester.findMany({
          where: {
            tenantId,
            institutionId,
            deletedAt: null,
            semesterNumber: { in: numbers },
          },
        });

        for (const sem of activeSemesters) {
          await tx.campusShiftActiveSemester.upsert({
            where: {
              institutionId_campusId_shiftId_semesterId: {
                institutionId,
                campusId: dto.campusId,
                shiftId: dto.shiftId,
                semesterId: sem.id,
              },
            },
            create: {
              tenantId,
              institutionId,
              campusId: dto.campusId,
              shiftId: dto.shiftId,
              semesterId: sem.id,
              activatedById: actorId ?? null,
            },
            update: {
              activatedAt: new Date(),
              activatedById: actorId ?? null,
            },
          });
        }

        const stale = await tx.campusShiftActiveSemester.findMany({
          where: {
            institutionId,
            campusId: dto.campusId,
            shiftId: dto.shiftId,
            semester: {
              semesterNumber: { in: oppositeNumbers },
            },
          },
        });
        for (const row of stale) {
          await tx.campusShiftActiveSemester.delete({ where: { id: row.id } });
        }
      }

      await tx.institutionAcademicConfig.upsert({
        where: { institutionId },
        create: {
          tenantId,
          institutionId,
          currentCycle: cycle,
          lastCycleSwitchAt: new Date(),
          lastCycleSwitchById: actorId ?? null,
        },
        update: {
          currentCycle: cycle,
          lastCycleSwitchAt: new Date(),
          lastCycleSwitchById: actorId ?? null,
        },
      });
    });

    return this.getActiveSemesters(tenantId, institutionId);
  }

  async getActiveSemesters(tenantId: string, institutionId: string) {
    return this.prisma.semester.findMany({
      where: {
        tenantId,
        institutionId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { semesterNumber: 'asc' },
      include: { academicYear: true },
    });
  }

  async getActiveForScope(
    tenantId: string,
    institutionId: string,
    campusId: string,
    shiftId: string,
  ) {
    const rows = await this.prisma.campusShiftActiveSemester.findMany({
      where: { tenantId, institutionId, campusId, shiftId },
      include: { semester: { include: { academicYear: true } } },
      orderBy: { semester: { semesterNumber: 'asc' } },
    });
    return rows.map((r) => r.semester);
  }

  async isSemesterOperational(
    tenantId: string,
    institutionId: string,
    semesterId: string,
  ) {
    const sem = await this.prisma.semester.findFirst({
      where: { id: semesterId, tenantId, institutionId, deletedAt: null },
    });
    if (!sem) return false;
    return sem.isActive && sem.status === 'ACTIVE' && sem.registrationOpen;
  }

  async resolveOperationalSemester(
    tenantId: string,
    institutionId: string,
    semesterSequence: number,
  ) {
    return this.prisma.semester.findFirst({
      where: {
        tenantId,
        institutionId,
        semesterNumber: semesterSequence,
        deletedAt: null,
        isActive: true,
        status: 'ACTIVE',
      },
      include: { academicYear: true },
    });
  }

  async getDashboard(tenantId: string, institutionId: string) {
    const config = await this.prisma.institutionAcademicConfig.findUnique({
      where: { institutionId },
    });

    const primarySession = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        institutionId,
        deletedAt: null,
        OR: [{ isPrimarySession: true }, { status: 'ACTIVE' }],
      },
      orderBy: [{ isPrimarySession: 'desc' }, { startDate: 'desc' }],
    });

    const semesters = await this.prisma.semester.findMany({
      where: { tenantId, institutionId, deletedAt: null },
      orderBy: { semesterNumber: 'asc' },
    });

    const batches = await this.prisma.admissionBatch.findMany({
      where: { tenantId, institutionId, deletedAt: null, isActive: true },
      include: {
        entrySession: true,
        semesterMapping: true,
        _count: { select: { studentProfiles: true } },
      },
      orderBy: { admissionYear: 'desc' },
    });

    const campusIds = (
      await this.prisma.campus.findMany({
        where: { tenantId, institutionId, deletedAt: null },
        select: { id: true },
      })
    ).map((c) => c.id);

    const totalStudents = await this.prisma.student.count({
      where: {
        tenantId,
        deletedAt: null,
        ...(campusIds.length > 0 ? { campusId: { in: campusIds } } : {}),
        academicStanding: {
          lifecycleState: { in: ['ACTIVE', 'DETAINED'] },
        },
      },
    });

    const studentCountBySemester = new Map<number, number>();
    for (const batch of batches) {
      const n = batch.currentSemester;
      studentCountBySemester.set(
        n,
        (studentCountBySemester.get(n) ?? 0) + batch._count.studentProfiles,
      );
    }

    const activeSemesters = semesters.filter((s) => s.isActive);

    const promotionRuns = await this.prisma.semesterPromotionRun.findMany({
      where: { tenantId, institutionId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const pendingPromotionBatches = batches.filter(
      (b) => b.promotionStatus === 'PREVIEW',
    ).length;

    return {
      config,
      primarySession,
      currentCycle: config?.currentCycle ?? 'ODD',
      activeSemesters: activeSemesters.map((s) => s.semesterNumber),
      totalStudents,
      promotionStatus: {
        pendingBatches: pendingPromotionBatches,
        recentRuns: promotionRuns.length,
      },
      semesterLifecycle: semesters.map((s) => ({
        semesterNumber: s.semesterNumber,
        semesterType: s.semesterType,
        cycle: cycleTypeFromSemesterNumber(s.semesterNumber),
        isActive: s.isActive,
        status: s.status,
        studentCount: studentCountBySemester.get(s.semesterNumber) ?? 0,
        registrationOpen: s.registrationOpen,
        frozen: s.status === 'FROZEN',
        id: s.id,
        name: s.name,
      })),
      batchProgression: batches.map((b) => ({
        id: b.id,
        batchCode: b.batchCode,
        admissionYear: b.admissionYear,
        entrySession: b.entrySession.name,
        currentSemester: b.currentSemester,
        cycleType: b.cycleType,
        promotionStatus: b.promotionStatus,
        studentCount: b._count.studentProfiles,
      })),
    };
  }

  async freezeCycleSemesters(
    tenantId: string,
    institutionId: string,
    cycle: AcademicCycle,
    frozenById?: string,
  ) {
    const numbers = semesterNumbersForCycle(cycle);
    return this.prisma.semester.updateMany({
      where: {
        tenantId,
        institutionId,
        deletedAt: null,
        semesterNumber: { in: numbers },
        status: { not: 'FROZEN' },
      },
      data: {
        status: 'FROZEN',
        isActive: false,
        registrationOpen: false,
        attendanceEnabled: false,
        examinationEnabled: false,
        timetableEnabled: false,
        feeCycleEnabled: false,
        resultProcessingEnabled: false,
        frozenAt: new Date(),
        frozenById: frozenById ?? null,
      },
    });
  }
}
