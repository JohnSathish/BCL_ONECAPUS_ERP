import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { RollNumberPreview } from './roll-number.service';

export type ParsedRollNumber = {
  prefix: string;
  yearSuffix: string;
  separator: string;
  sequence: number;
  admissionYear: number;
};

export type ShiftCapacityRow = {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  admissionYear: number;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  used: number;
  vacant: number;
  reserved: number;
  available: number;
  nextSequence: number;
  configured: boolean;
};

@Injectable()
export class RollShiftRangeService {
  constructor(private readonly prisma: PrismaService) {}

  parseRollNumber(
    rollNumber: string,
    settings?: { separator: string },
  ): ParsedRollNumber | null {
    const trimmed = rollNumber.trim();
    const sep = settings?.separator ?? '-';
    const pattern =
      sep === '-'
        ? /^([A-Z]{2,4})(\d{2})-(\d+)$/
        : new RegExp(`^([A-Z]{2,4})(\\d{2})\\${sep}(\\d+)$`);
    const match = trimmed.match(pattern);
    if (!match) return null;
    const yearSuffix = match[2];
    const sequence = Number.parseInt(match[3], 10);
    if (!Number.isFinite(sequence)) return null;
    const admissionYear =
      Number.parseInt(yearSuffix, 10) >= 50
        ? 1900 + Number.parseInt(yearSuffix, 10)
        : 2000 + Number.parseInt(yearSuffix, 10);
    return {
      prefix: match[1],
      yearSuffix,
      separator: sep,
      sequence,
      admissionYear,
    };
  }

  formatRollNumber(
    prefix: string,
    yearSuffix: string,
    sequence: number,
    settings: { sequenceLength: number; separator: string },
  ): string {
    const padded = String(sequence).padStart(settings.sequenceLength, '0');
    return `${prefix}${yearSuffix}${settings.separator}${padded}`;
  }

  async hasActiveShiftRanges(
    tenantId: string,
    institutionId: string,
    admissionYear: number,
  ): Promise<boolean> {
    const count = await this.prisma.rollShiftRangeConfig.count({
      where: {
        tenantId,
        institutionId,
        admissionYear,
        isActive: true,
      },
    });
    return count > 0;
  }

  async listShiftRanges(
    tenantId: string,
    institutionId?: string,
    admissionYear?: number,
  ) {
    const shifts = await this.prisma.shift.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        institutionId: true,
      },
    });

    const configs = await this.prisma.rollShiftRangeConfig.findMany({
      where: {
        tenantId,
        ...(institutionId ? { institutionId } : {}),
        ...(admissionYear ? { admissionYear } : {}),
      },
      orderBy: [{ admissionYear: 'desc' }, { sequenceStart: 'asc' }],
    });

    const configByKey = new Map(
      configs.map((c) => [`${c.shiftId}:${c.admissionYear}`, c]),
    );

    const years = admissionYear
      ? [admissionYear]
      : [...new Set(configs.map((c) => c.admissionYear))].sort((a, b) => b - a);

    const defaultYear = admissionYear ?? years[0] ?? new Date().getFullYear();

    return {
      admissionYear: defaultYear,
      shifts: shifts.map((shift) => {
        const cfg = configByKey.get(`${shift.id}:${defaultYear}`);
        const capacity = cfg ? cfg.sequenceEnd - cfg.sequenceStart + 1 : 0;
        const availableSeats = cfg
          ? Math.max(0, cfg.sequenceEnd - cfg.nextSequence + 1)
          : 0;
        return {
          shiftId: shift.id,
          shiftCode: shift.code,
          shiftName: shift.name,
          institutionId: shift.institutionId,
          admissionYear: defaultYear,
          sequenceStart: cfg?.sequenceStart ?? null,
          sequenceEnd: cfg?.sequenceEnd ?? null,
          nextSequence: cfg?.nextSequence ?? null,
          currentSequence: cfg
            ? Math.max(cfg.sequenceStart, cfg.nextSequence - 1)
            : null,
          availableSeats,
          capacity,
          configured: Boolean(cfg),
          isActive: cfg?.isActive ?? false,
        };
      }),
    };
  }

  async upsertShiftRanges(
    tenantId: string,
    institutionId: string,
    ranges: Array<{
      shiftId: string;
      admissionYear: number;
      sequenceStart: number;
      sequenceEnd: number;
      nextSequence?: number;
    }>,
    actorId?: string,
  ) {
    if (!ranges.length) {
      throw new BadRequestException('At least one shift range is required');
    }

    for (const item of ranges) {
      if (item.sequenceStart > item.sequenceEnd) {
        throw new BadRequestException(
          `Invalid range for shift ${item.shiftId}: start must be <= end`,
        );
      }
      const next = item.nextSequence ?? item.sequenceStart;
      if (next < item.sequenceStart || next > item.sequenceEnd + 1) {
        throw new BadRequestException(
          `nextSequence for shift ${item.shiftId} must be within ${item.sequenceStart}–${item.sequenceEnd + 1}`,
        );
      }

      const shift = await this.prisma.shift.findFirst({
        where: {
          id: item.shiftId,
          tenantId,
          institutionId,
          deletedAt: null,
        },
      });
      if (!shift) {
        throw new NotFoundException(`Shift ${item.shiftId} not found`);
      }

      await this.prisma.rollShiftRangeConfig.upsert({
        where: {
          tenantId_institutionId_shiftId_admissionYear: {
            tenantId,
            institutionId,
            shiftId: item.shiftId,
            admissionYear: item.admissionYear,
          },
        },
        create: {
          tenantId,
          institutionId,
          shiftId: item.shiftId,
          admissionYear: item.admissionYear,
          sequenceStart: item.sequenceStart,
          sequenceEnd: item.sequenceEnd,
          nextSequence: next,
          isActive: true,
        },
        update: {
          sequenceStart: item.sequenceStart,
          sequenceEnd: item.sequenceEnd,
          nextSequence: next,
          isActive: true,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'UPDATE',
        module: 'roll-shift-range',
        entityType: 'RollShiftRangeConfig',
        entityId: institutionId,
        metadata: { ranges } as Prisma.InputJsonValue,
      },
    });

    return this.listShiftRanges(
      tenantId,
      institutionId,
      ranges[0]?.admissionYear,
    );
  }

  async getCapacityDashboard(
    tenantId: string,
    institutionId?: string,
    admissionYear?: number,
  ): Promise<ShiftCapacityRow[]> {
    const year = admissionYear ?? new Date().getFullYear();
    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const configs = await this.prisma.rollShiftRangeConfig.findMany({
      where: {
        tenantId,
        admissionYear: year,
        isActive: true,
        ...(institutionId ? { institutionId } : {}),
      },
    });
    const configByShift = new Map(configs.map((c) => [c.shiftId, c]));

    const settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    const separator = settings?.separator ?? '-';

    const rows: ShiftCapacityRow[] = [];
    for (const shift of shifts) {
      const cfg = configByShift.get(shift.id);
      if (!cfg) {
        rows.push({
          shiftId: shift.id,
          shiftCode: shift.code,
          shiftName: shift.name,
          admissionYear: year,
          rangeStart: 0,
          rangeEnd: 0,
          capacity: 0,
          used: 0,
          vacant: 0,
          reserved: 0,
          available: 0,
          nextSequence: 0,
          configured: false,
        });
        continue;
      }

      const capacity = cfg.sequenceEnd - cfg.sequenceStart + 1;

      const [assignedStudents, vacancies] = await Promise.all([
        this.prisma.student.findMany({
          where: {
            tenantId,
            deletedAt: null,
            primaryShiftId: shift.id,
            rollNumber: { not: null },
            academicProfile: {
              admissionBatch: { admissionYear: year },
            },
          },
          select: { rollNumber: true },
        }),
        this.prisma.rollNumberVacancy.findMany({
          where: {
            tenantId,
            shiftId: shift.id,
            admissionYear: year,
          },
          select: { status: true, sequenceNo: true },
        }),
      ]);

      let usedInRange = 0;
      for (const s of assignedStudents) {
        if (!s.rollNumber) continue;
        const parsed = this.parseRollNumber(s.rollNumber, { separator });
        if (
          parsed &&
          parsed.sequence >= cfg.sequenceStart &&
          parsed.sequence <= cfg.sequenceEnd
        ) {
          usedInRange += 1;
        }
      }

      const vacant = vacancies.filter((v) => v.status === 'VACANT').length;
      const reserved = vacancies.filter((v) => v.status === 'RESERVED').length;
      const used = usedInRange + vacant + reserved;
      const available = Math.max(0, capacity - used);

      rows.push({
        shiftId: shift.id,
        shiftCode: shift.code,
        shiftName: shift.name,
        admissionYear: year,
        rangeStart: cfg.sequenceStart,
        rangeEnd: cfg.sequenceEnd,
        capacity,
        used,
        vacant,
        reserved,
        available,
        nextSequence: cfg.nextSequence,
        configured: true,
      });
    }

    return rows;
  }

  async findShiftConfig(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    institutionId: string,
    shiftId: string,
    admissionYear: number,
  ) {
    return tx.rollShiftRangeConfig.findFirst({
      where: {
        tenantId,
        institutionId,
        shiftId,
        admissionYear,
        isActive: true,
      },
    });
  }

  async allocateInShiftRange(
    tx: Prisma.TransactionClient,
    tenantId: string,
    input: {
      institutionId: string;
      shiftId: string;
      admissionYear: number;
      prefix: string;
      yearSuffix: string;
      streamCode: string;
      settings: { sequenceLength: number; separator: string };
    },
  ): Promise<RollNumberPreview | null> {
    const config = await this.findShiftConfig(
      tx,
      tenantId,
      input.institutionId,
      input.shiftId,
      input.admissionYear,
    );
    if (!config) return null;

    if (config.nextSequence > config.sequenceEnd) {
      throw new BadRequestException(
        `Shift roll number range exhausted (${config.sequenceStart}–${config.sequenceEnd})`,
      );
    }

    const sequence = config.nextSequence;
    await tx.rollShiftRangeConfig.update({
      where: { id: config.id },
      data: { nextSequence: sequence + 1 },
    });

    const rollNumber = this.formatRollNumber(
      input.prefix,
      input.yearSuffix,
      sequence,
      input.settings,
    );

    const reserved = await tx.rollNumberVacancy.findFirst({
      where: {
        tenantId,
        rollNumber,
        status: 'RESERVED',
      },
    });
    if (reserved) {
      throw new ConflictException(
        `Roll number ${rollNumber} is reserved and cannot be auto-assigned`,
      );
    }

    return {
      rollNumber,
      prefix: input.prefix,
      yearSuffix: input.yearSuffix,
      sequence,
      admissionYear: input.admissionYear,
      streamCode: input.streamCode,
    };
  }

  async vacateRollNumber(
    tenantId: string,
    input: {
      rollNumber: string;
      institutionId: string;
      shiftId?: string | null;
      studentId?: string;
      reason?: string;
      actorId?: string;
    },
  ) {
    const settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    const parsed = this.parseRollNumber(input.rollNumber, {
      separator: settings?.separator ?? '-',
    });

    await this.prisma.rollNumberVacancy.upsert({
      where: {
        tenantId_rollNumber: {
          tenantId,
          rollNumber: input.rollNumber.trim(),
        },
      },
      create: {
        tenantId,
        institutionId: input.institutionId,
        rollNumber: input.rollNumber.trim(),
        shiftId: input.shiftId ?? undefined,
        sequenceNo: parsed?.sequence,
        admissionYear: parsed?.admissionYear,
        studentId: input.studentId,
        status: 'VACANT',
        reason: input.reason,
        createdById: input.actorId,
      },
      update: {
        status: 'VACANT',
        reason: input.reason,
        shiftId: input.shiftId ?? undefined,
        studentId: input.studentId,
        vacatedAt: new Date(),
        createdById: input.actorId,
      },
    });
  }

  async reserveRollNumber(
    tenantId: string,
    input: {
      rollNumber: string;
      shiftId?: string;
      note?: string;
      institutionId: string;
      actorId?: string;
    },
  ) {
    const trimmed = input.rollNumber.trim();
    const existingStudent = await this.prisma.student.findFirst({
      where: { tenantId, rollNumber: trimmed, deletedAt: null },
    });
    if (existingStudent) {
      throw new ConflictException(`Roll number ${trimmed} is already assigned`);
    }

    const settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    const parsed = this.parseRollNumber(trimmed, {
      separator: settings?.separator ?? '-',
    });

    return this.prisma.rollNumberVacancy.upsert({
      where: { tenantId_rollNumber: { tenantId, rollNumber: trimmed } },
      create: {
        tenantId,
        institutionId: input.institutionId,
        rollNumber: trimmed,
        shiftId: input.shiftId,
        sequenceNo: parsed?.sequence,
        admissionYear: parsed?.admissionYear,
        status: 'RESERVED',
        reservedNote: input.note,
        reason: 'RESERVED',
        createdById: input.actorId,
      },
      update: {
        status: 'RESERVED',
        reservedNote: input.note,
        shiftId: input.shiftId,
        reason: 'RESERVED',
        createdById: input.actorId,
      },
    });
  }

  async processShiftTransferRollChange(
    tenantId: string,
    input: {
      studentId: string;
      fromShiftId: string;
      toShiftId: string;
      transferId: string;
      reason?: string;
      actorId?: string;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, tenantId, deletedAt: null },
      include: {
        academicProfile: {
          include: {
            admissionBatch: { include: { entrySession: true } },
            stream: true,
          },
        },
      },
    });
    if (
      !student?.academicProfile?.streamId ||
      !student.academicProfile.admissionBatchId
    ) {
      return {
        oldRollNumber: student?.rollNumber ?? null,
        newRollNumber: student?.rollNumber ?? null,
      };
    }

    const profile = student.academicProfile;
    const institutionId =
      profile.admissionBatch?.entrySession?.institutionId ??
      (student.campusId
        ? (
            await this.prisma.campus.findFirst({
              where: { id: student.campusId, tenantId },
              select: { institutionId: true },
            })
          )?.institutionId
        : null);

    if (!institutionId) {
      throw new BadRequestException(
        'Cannot resolve institution for roll transfer',
      );
    }

    const admissionYear = profile.admissionBatch!.admissionYear;
    const shiftRangesActive = await this.hasActiveShiftRanges(
      tenantId,
      institutionId,
      admissionYear,
    );
    if (!shiftRangesActive) {
      return {
        oldRollNumber: student.rollNumber,
        newRollNumber: student.rollNumber,
      };
    }

    const settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    const rollSettings = {
      sequenceLength: settings?.sequenceLength ?? 3,
      separator: settings?.separator ?? '-',
    };

    const prefixConfig = await this.prisma.rollPrefixConfig.findFirst({
      where: { tenantId, streamId: profile.streamId!, isActive: true },
    });
    if (!prefixConfig?.prefix) {
      throw new BadRequestException(
        'Roll prefix not configured for student stream',
      );
    }

    const yearSuffix = String(admissionYear).slice(-2);
    const oldRollNumber = student.rollNumber;

    return this.prisma.$transaction(async (tx) => {
      if (oldRollNumber) {
        await tx.rollNumberVacancy.upsert({
          where: {
            tenantId_rollNumber: { tenantId, rollNumber: oldRollNumber },
          },
          create: {
            tenantId,
            institutionId,
            rollNumber: oldRollNumber,
            shiftId: input.fromShiftId,
            sequenceNo: this.parseRollNumber(oldRollNumber, rollSettings)
              ?.sequence,
            admissionYear,
            studentId: input.studentId,
            status: 'VACANT',
            reason: input.reason ?? 'Shift transfer',
            createdById: input.actorId,
          },
          update: {
            status: 'VACANT',
            reason: input.reason ?? 'Shift transfer',
            shiftId: input.fromShiftId,
            studentId: input.studentId,
            vacatedAt: new Date(),
            createdById: input.actorId,
          },
        });
      }

      const allocated = await this.allocateInShiftRange(tx, tenantId, {
        institutionId,
        shiftId: input.toShiftId,
        admissionYear,
        prefix: prefixConfig.prefix,
        yearSuffix,
        streamCode: profile.stream!.code,
        settings: rollSettings,
      });

      if (!allocated) {
        throw new BadRequestException(
          'Target shift has no roll number range configured',
        );
      }

      await tx.student.update({
        where: { id: input.studentId },
        data: {
          rollNumber: allocated.rollNumber,
          primaryShiftId: input.toShiftId,
          lastModifiedById: input.actorId,
        },
      });

      await tx.studentShiftTransfer.update({
        where: { id: input.transferId },
        data: {
          oldRollNumber,
          newRollNumber: allocated.rollNumber,
        },
      });

      await tx.studentRollNumberAuditLog.create({
        data: {
          tenantId,
          institutionId,
          studentId: input.studentId,
          action: 'SHIFT_TRANSFER',
          rollNumber: allocated.rollNumber,
          oldValue: oldRollNumber,
          newValue: allocated.rollNumber,
          createdById: input.actorId,
          metadata: {
            fromShiftId: input.fromShiftId,
            toShiftId: input.toShiftId,
            transferId: input.transferId,
            reason: input.reason,
          } as Prisma.InputJsonValue,
        },
      });

      return { oldRollNumber, newRollNumber: allocated.rollNumber };
    });
  }

  async bulkShiftTransferWithRollRegeneration(
    tenantId: string,
    input: {
      studentIds: string[];
      toShiftId: string;
      reason?: string;
      actorId?: string;
    },
  ) {
    const toShift = await this.prisma.shift.findFirst({
      where: {
        id: input.toShiftId,
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!toShift) throw new NotFoundException('Target shift not found');

    const results: Array<{
      studentId: string;
      status: 'success' | 'failed';
      oldRollNumber?: string | null;
      newRollNumber?: string | null;
      error?: string;
    }> = [];

    for (const studentId of input.studentIds) {
      try {
        const student = await this.prisma.student.findFirst({
          where: { id: studentId, tenantId, deletedAt: null },
        });
        if (!student?.primaryShiftId) {
          throw new BadRequestException('Student has no primary shift');
        }
        if (student.primaryShiftId === input.toShiftId) {
          throw new BadRequestException('Student already on target shift');
        }

        const transfer = await this.prisma.studentShiftTransfer.create({
          data: {
            tenantId,
            studentId,
            fromShiftId: student.primaryShiftId,
            toShiftId: input.toShiftId,
            reason: input.reason,
            status: 'approved',
            approvedById: input.actorId,
            approvedAt: new Date(),
          },
        });

        await this.prisma.studentAcademicProfile.updateMany({
          where: { studentId },
          data: { preferredShiftId: input.toShiftId },
        });

        const rollChange = await this.processShiftTransferRollChange(tenantId, {
          studentId,
          fromShiftId: student.primaryShiftId,
          toShiftId: input.toShiftId,
          transferId: transfer.id,
          reason: input.reason,
          actorId: input.actorId,
        });

        const profile = await this.prisma.studentAcademicProfile.findFirst({
          where: { studentId },
          include: {
            admissionBatch: { include: { entrySession: true } },
          },
        });
        const institutionId =
          profile?.admissionBatch?.entrySession?.institutionId;
        const admissionYear = profile?.admissionBatch?.admissionYear;
        const shiftRangesActive =
          institutionId && admissionYear
            ? await this.hasActiveShiftRanges(
                tenantId,
                institutionId,
                admissionYear,
              )
            : false;

        if (!shiftRangesActive) {
          await this.prisma.student.update({
            where: { id: studentId },
            data: { primaryShiftId: input.toShiftId },
          });
        }

        results.push({
          studentId,
          status: 'success',
          oldRollNumber: rollChange.oldRollNumber,
          newRollNumber: rollChange.newRollNumber,
        });
      } catch (err) {
        results.push({
          studentId,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Transfer failed',
        });
      }
    }

    return {
      total: input.studentIds.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  async getStudentRollShiftHistory(tenantId: string, studentId: string) {
    const [auditLogs, transfers, student] = await Promise.all([
      this.prisma.studentRollNumberAuditLog.findMany({
        where: { tenantId, studentId },
        orderBy: { generatedAt: 'desc' },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.studentShiftTransfer.findMany({
        where: { tenantId, studentId },
        orderBy: { createdAt: 'desc' },
        include: {
          fromShift: { select: { id: true, code: true, name: true } },
          toShift: { select: { id: true, code: true, name: true } },
          approvedBy: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.student.findFirst({
        where: { id: studentId, tenantId, deletedAt: null },
        include: {
          primaryShift: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    if (!student) throw new NotFoundException('Student not found');

    const previousTransfer = transfers.find((t) => t.status === 'approved');

    return {
      currentRollNumber: student.rollNumber,
      currentShift: student.primaryShift,
      previousRollNumber: previousTransfer?.oldRollNumber ?? null,
      previousShift: previousTransfer?.fromShift ?? null,
      transferHistory: transfers.map((t) => ({
        id: t.id,
        fromShift: t.fromShift,
        toShift: t.toShift,
        oldRollNumber: t.oldRollNumber,
        newRollNumber: t.newRollNumber,
        status: t.status,
        reason: t.reason,
        changedBy: t.approvedBy,
        changedAt: t.approvedAt ?? t.createdAt,
      })),
      rollAuditHistory: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        rollNumber: log.rollNumber,
        oldValue: log.oldValue,
        newValue: log.newValue,
        changedBy: log.createdBy,
        changedAt: log.generatedAt,
        metadata: log.metadata,
      })),
    };
  }
}
