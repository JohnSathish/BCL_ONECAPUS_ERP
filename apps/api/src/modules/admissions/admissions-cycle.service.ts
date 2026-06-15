import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';

export type CycleSettings = {
  applicationNumberPrefix?: string;
  applicationFee?: number;
  admissionFeeMin?: number;
  meritRules?: {
    class12Weight?: number;
    cuetWeight?: number;
    tieBreakers?: string[];
  };
  /** When false, applicants may submit before fee is recorded (default: required). */
  requirePaymentBeforeSubmit?: boolean;
  helpDesk?: { phone?: string; email?: string };
};

@Injectable()
export class AdmissionsCycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async bustPortalInfoCache(tenantId: string) {
    await this.cache.del(`admissions:portal:info:${tenantId}`);
  }

  listCycles(tenantId: string, status?: string) {
    return this.prisma.admissionCycle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: {
          select: {
            applications: { where: { deletedAt: null } },
            intakes: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getCycle(tenantId: string, id: string) {
    return this.prisma.admissionCycle.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        academicYear: true,
        programs: { include: { program: true } },
        intakes: {
          where: { deletedAt: null },
          include: {
            program: true,
            shiftCaps: { include: { shift: true } },
          },
        },
      },
    });
  }

  async getActiveCycle(tenantId: string) {
    return this.prisma.admissionCycle.findFirst({
      where: { tenantId, status: 'OPEN', deletedAt: null },
      include: { academicYear: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCycle(
    tenantId: string,
    id: string,
    data: {
      title?: string;
      registrationOpensAt?: Date;
      registrationClosesAt?: Date;
      applicationDeadline?: Date;
      paymentDeadline?: Date;
      settings?: CycleSettings;
    },
    actorId?: string,
  ) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    if (cycle.status === 'ARCHIVED') {
      throw new BadRequestException('Archived cycles are read-only');
    }

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.registrationOpensAt !== undefined
          ? { registrationOpensAt: data.registrationOpensAt }
          : {}),
        ...(data.registrationClosesAt !== undefined
          ? { registrationClosesAt: data.registrationClosesAt }
          : {}),
        ...(data.applicationDeadline !== undefined
          ? { applicationDeadline: data.applicationDeadline }
          : {}),
        ...(data.paymentDeadline !== undefined
          ? { paymentDeadline: data.paymentDeadline }
          : {}),
        ...(data.settings !== undefined
          ? {
              settings: {
                ...((cycle.settings as CycleSettings) ?? {}),
                ...data.settings,
              } as Prisma.InputJsonValue,
            }
          : {}),
      },
      include: { academicYear: true },
    });

    await this.audit(
      tenantId,
      id,
      'cycle',
      id,
      'cycle.updated',
      actorId,
      null,
      {
        title: updated.title,
      },
    );
    await this.bustPortalInfoCache(tenantId);
    return updated;
  }

  async publishCycle(tenantId: string, id: string, actorId?: string) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    if (cycle.status !== 'DRAFT' && cycle.status !== 'CLOSED') {
      throw new BadRequestException(
        'Only draft or closed cycles can be published',
      );
    }

    await this.prisma.admissionCycle.updateMany({
      where: {
        tenantId,
        status: 'OPEN',
        deletedAt: null,
        id: { not: id },
      },
      data: { status: 'CLOSED' },
    });

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: { status: 'OPEN' },
      include: { academicYear: true },
    });

    await this.audit(tenantId, id, 'cycle', id, 'cycle.published', actorId);
    await this.bustPortalInfoCache(tenantId);
    return updated;
  }

  async closeCycle(tenantId: string, id: string, actorId?: string) {
    const cycle = await this.getCycle(tenantId, id);
    if (!cycle) throw new NotFoundException('Admission cycle not found');
    if (cycle.status !== 'OPEN') {
      throw new BadRequestException('Only open cycles can be closed');
    }

    const updated = await this.prisma.admissionCycle.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    await this.audit(tenantId, id, 'cycle', id, 'cycle.closed', actorId);
    await this.bustPortalInfoCache(tenantId);
    return updated;
  }

  async upsertCycleProgram(
    tenantId: string,
    cycleId: string,
    programId: string,
    enabled: boolean,
  ) {
    const cycle = await this.getCycle(tenantId, cycleId);
    if (!cycle) throw new NotFoundException('Admission cycle not found');

    return this.prisma.admissionCycleProgram.upsert({
      where: { cycleId_programId: { cycleId, programId } },
      update: { enabled },
      create: { tenantId, cycleId, programId, enabled },
      include: { program: true },
    });
  }

  async upsertIntakeShift(
    tenantId: string,
    intakeId: string,
    shiftId: string,
    totalSeats: number,
    reservedSeats?: Record<string, number>,
  ) {
    const intake = await this.prisma.admissionIntake.findFirst({
      where: { id: intakeId, tenantId, deletedAt: null },
    });
    if (!intake) throw new NotFoundException('Intake not found');

    return this.prisma.admissionIntakeShift.upsert({
      where: { intakeId_shiftId: { intakeId, shiftId } },
      update: {
        totalSeats,
        reservedSeats: (reservedSeats ?? {}) as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        intakeId,
        shiftId,
        totalSeats,
        reservedSeats: (reservedSeats ?? {}) as Prisma.InputJsonValue,
      },
      include: { shift: true },
    });
  }

  /** Called after academicYear.create — archives prior cycles and provisions a DRAFT cycle. */
  async onAcademicYearCreated(
    tenantId: string,
    institutionId: string,
    academicYearId: string,
    academicYearName: string,
    actorId?: string,
  ) {
    const now = new Date();

    const priorCycles = await this.prisma.admissionCycle.findMany({
      where: {
        tenantId,
        institutionId,
        status: { in: ['OPEN', 'CLOSED', 'DRAFT'] },
        deletedAt: null,
      },
      include: {
        intakes: {
          where: { deletedAt: null },
          include: { shiftCaps: true },
        },
        programs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (priorCycles.length > 0) {
      await this.prisma.admissionCycle.updateMany({
        where: {
          tenantId,
          institutionId,
          status: { in: ['OPEN', 'CLOSED', 'DRAFT'] },
          deletedAt: null,
        },
        data: { status: 'ARCHIVED', archivedAt: now },
      });
    }

    const template = priorCycles[0];
    const yearShort = academicYearName.replace(/\D/g, '').slice(-2) || '26';
    const code = `ADM-${academicYearName.replace(/\s+/g, '-')}`;

    const settings: CycleSettings = (template?.settings as CycleSettings) ?? {
      applicationNumberPrefix: `DBCT${yearShort}`,
      applicationFee: 600,
      admissionFeeMin: 10500,
      meritRules: {
        class12Weight: 1,
        tieBreakers: ['meritScore', 'submittedAt'],
      },
    };

    const cycle = await this.prisma.admissionCycle.create({
      data: {
        tenantId,
        institutionId,
        academicYearId,
        code,
        title: `Admission ${academicYearName}`,
        status: 'DRAFT',
        settings: settings as Prisma.InputJsonValue,
        registrationOpensAt: template?.registrationOpensAt,
        registrationClosesAt: template?.registrationClosesAt,
        applicationDeadline: template?.applicationDeadline,
        paymentDeadline: template?.paymentDeadline,
      },
    });

    if (template) {
      for (const cp of template.programs) {
        await this.prisma.admissionCycleProgram.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: cp.programId,
            enabled: cp.enabled,
          },
        });
      }

      for (const intake of template.intakes) {
        const newIntake = await this.prisma.admissionIntake.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: intake.programId,
            academicYearId,
            name: intake.name.replace(/\d{4}/, yearShort) || intake.name,
            code: `${intake.code.split('-')[0]}-${yearShort}`,
            totalSeats: intake.totalSeats,
            status: 'draft',
          },
        });

        for (const cap of intake.shiftCaps) {
          await this.prisma.admissionIntakeShift.create({
            data: {
              tenantId,
              intakeId: newIntake.id,
              shiftId: cap.shiftId,
              totalSeats: cap.totalSeats,
              reservedSeats: cap.reservedSeats as Prisma.InputJsonValue,
            },
          });
        }
      }
    } else {
      const programs = await this.prisma.program.findMany({
        where: { tenantId, deletedAt: null },
        take: 20,
      });
      for (const program of programs) {
        await this.prisma.admissionCycleProgram.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: program.id,
            enabled: true,
          },
        });
        const intake = await this.prisma.admissionIntake.create({
          data: {
            tenantId,
            cycleId: cycle.id,
            programId: program.id,
            academicYearId,
            name: `${program.name} Admission ${academicYearName}`,
            code: `${program.code}-${yearShort}`,
            totalSeats: 60,
            status: 'draft',
          },
        });
        const shifts = await this.prisma.shift.findMany({
          where: { tenantId, deletedAt: null },
          take: 3,
        });
        const perShift = Math.max(
          1,
          Math.floor(60 / Math.max(shifts.length, 1)),
        );
        for (const shift of shifts) {
          await this.prisma.admissionIntakeShift.create({
            data: {
              tenantId,
              intakeId: intake.id,
              shiftId: shift.id,
              totalSeats: perShift,
              reservedSeats: { GENERAL: perShift } as Prisma.InputJsonValue,
            },
          });
        }
      }
    }

    await this.audit(
      tenantId,
      cycle.id,
      'cycle',
      cycle.id,
      'cycle.provisioned',
      actorId,
      null,
      { academicYearId, code },
    );

    return cycle;
  }

  async nextApplicationNumber(cycleId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.admissionCycle.findUniqueOrThrow({
        where: { id: cycleId },
      });
      const settings = (cycle.settings as CycleSettings) ?? {};
      const prefix = settings.applicationNumberPrefix ?? 'DBCT26';
      const seq = cycle.applicationSeq + 1;
      await tx.admissionCycle.update({
        where: { id: cycleId },
        data: { applicationSeq: seq },
      });
      return `${prefix}-${String(seq).padStart(4, '0')}`;
    });
  }

  async audit(
    tenantId: string,
    cycleId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    actorId?: string | null,
    oldValue?: Prisma.InputJsonValue | null,
    newValue?: Prisma.InputJsonValue | null,
  ) {
    await this.prisma.admissionAuditLog.create({
      data: {
        tenantId,
        cycleId,
        entityType,
        entityId,
        action,
        actorId: actorId ?? null,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
      },
    });
  }
}
