import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type RollNumberContext = {
  institutionId: string;
  streamId: string;
  streamCode: string;
  prefix: string;
  admissionYear: number;
  yearSuffix: string;
  admissionBatchId: string;
};

export type RollNumberPreview = {
  rollNumber: string;
  prefix: string;
  yearSuffix: string;
  sequence: number;
  admissionYear: number;
  streamCode: string;
};

const ROLL_PATTERN = /^([A-Z]{2,4})(\d{2})-(\d+)$/;

@Injectable()
export class RollNumberService {
  constructor(private readonly prisma: PrismaService) {}

  formatRollNumber(
    prefix: string,
    yearSuffix: string,
    sequence: number,
    settings: { sequenceLength: number; separator: string },
  ): string {
    const padded = String(sequence).padStart(settings.sequenceLength, '0');
    return `${prefix}${yearSuffix}${settings.separator}${padded}`;
  }

  async getSettings(tenantId: string) {
    let settings = await this.prisma.rollNumberSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = await this.prisma.rollNumberSettings.create({
        data: {
          tenantId,
          sequenceLength: 3,
          separator: '-',
          autoGenerateOnAdmit: true,
        },
      });
    }
    return settings;
  }

  async resolveContext(
    tenantId: string,
    input: { streamId: string; admissionBatchId: string },
  ): Promise<RollNumberContext> {
    const [stream, batch, prefixConfig] = await Promise.all([
      this.prisma.academicStream.findFirst({
        where: {
          id: input.streamId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.admissionBatch.findFirst({
        where: { id: input.admissionBatchId, tenantId, deletedAt: null },
        include: { entrySession: true },
      }),
      this.prisma.rollPrefixConfig.findFirst({
        where: { tenantId, streamId: input.streamId, isActive: true },
      }),
    ]);

    if (!stream)
      throw new BadRequestException('Invalid or inactive academic stream');
    if (!batch) throw new BadRequestException('Invalid admission batch');
    const institutionId = batch.entrySession?.institutionId;
    if (!institutionId) {
      throw new BadRequestException('Admission batch has no institution');
    }
    if (!prefixConfig?.prefix?.trim()) {
      throw new BadRequestException(
        `Roll number prefix not configured for stream ${stream.code}. Configure it in Roll Number Settings.`,
      );
    }

    const yearSuffix = String(batch.admissionYear).slice(-2);

    return {
      institutionId,
      streamId: stream.id,
      streamCode: stream.code,
      prefix: prefixConfig.prefix.trim().toUpperCase(),
      admissionYear: batch.admissionYear,
      yearSuffix,
      admissionBatchId: batch.id,
    };
  }

  private async readNextSequence(
    tx: Prisma.TransactionClient,
    tenantId: string,
    institutionId: string,
    prefix: string,
    admissionYear: number,
  ): Promise<number> {
    const row = await tx.rollNumberSequence.findUnique({
      where: {
        institutionId_prefix_admissionYear: {
          institutionId,
          prefix,
          admissionYear,
        },
      },
    });
    return row?.nextSequence ?? 1;
  }

  async previewNextRollNumber(
    tenantId: string,
    input: { streamId: string; admissionBatchId: string },
  ): Promise<RollNumberPreview> {
    const ctx = await this.resolveContext(tenantId, input);
    const settings = await this.getSettings(tenantId);
    const sequence = await this.readNextSequence(
      this.prisma,
      tenantId,
      ctx.institutionId,
      ctx.prefix,
      ctx.admissionYear,
    );
    const rollNumber = this.formatRollNumber(
      ctx.prefix,
      ctx.yearSuffix,
      sequence,
      settings,
    );
    return {
      rollNumber,
      prefix: ctx.prefix,
      yearSuffix: ctx.yearSuffix,
      sequence,
      admissionYear: ctx.admissionYear,
      streamCode: ctx.streamCode,
    };
  }

  async allocateNextRollNumber(
    tenantId: string,
    input: { streamId: string; admissionBatchId: string },
  ): Promise<RollNumberPreview> {
    const ctx = await this.resolveContext(tenantId, input);
    const settings = await this.getSettings(tenantId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.rollNumberSequence.findUnique({
        where: {
          institutionId_prefix_admissionYear: {
            institutionId: ctx.institutionId,
            prefix: ctx.prefix,
            admissionYear: ctx.admissionYear,
          },
        },
      });

      let sequence: number;
      if (existing) {
        sequence = existing.nextSequence;
        await tx.rollNumberSequence.update({
          where: { id: existing.id },
          data: { nextSequence: sequence + 1 },
        });
      } else {
        sequence = 1;
        await tx.rollNumberSequence.create({
          data: {
            tenantId,
            institutionId: ctx.institutionId,
            prefix: ctx.prefix,
            admissionYear: ctx.admissionYear,
            nextSequence: 2,
          },
        });
      }

      const rollNumber = this.formatRollNumber(
        ctx.prefix,
        ctx.yearSuffix,
        sequence,
        settings,
      );

      await this.validateRollNumberUniqueTx(
        tx,
        tenantId,
        ctx.institutionId,
        rollNumber,
      );

      return {
        rollNumber,
        prefix: ctx.prefix,
        yearSuffix: ctx.yearSuffix,
        sequence,
        admissionYear: ctx.admissionYear,
        streamCode: ctx.streamCode,
      };
    });
  }

  async validateRollNumberUnique(
    tenantId: string,
    institutionId: string,
    rollNumber: string,
    excludeStudentId?: string,
  ): Promise<void> {
    await this.validateRollNumberUniqueTx(
      this.prisma,
      tenantId,
      institutionId,
      rollNumber,
      excludeStudentId,
    );
  }

  private async validateRollNumberUniqueTx(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    institutionId: string,
    rollNumber: string,
    excludeStudentId?: string,
  ): Promise<void> {
    const trimmed = rollNumber.trim();
    if (!trimmed) return;

    const taken = await tx.student.findFirst({
      where: {
        tenantId,
        rollNumber: trimmed,
        deletedAt: null,
        ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
      },
      include: {
        academicProfile: {
          include: { admissionBatch: { include: { entrySession: true } } },
        },
      },
    });

    if (!taken) return;

    let takenInstitutionId =
      taken.academicProfile?.admissionBatch?.entrySession?.institutionId ??
      null;

    if (!takenInstitutionId && taken.campusId) {
      const campus = await tx.campus.findFirst({
        where: { id: taken.campusId, tenantId },
        select: { institutionId: true },
      });
      takenInstitutionId = campus?.institutionId ?? null;
    }

    if (!takenInstitutionId || takenInstitutionId === institutionId) {
      throw new ConflictException('Roll number already in use');
    }
  }

  async writeAuditLog(
    tenantId: string,
    input: {
      action: string;
      rollNumber: string;
      institutionId?: string;
      studentId?: string;
      oldValue?: string | null;
      newValue?: string | null;
      manualOverride?: boolean;
      createdById?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.prisma.studentRollNumberAuditLog.create({
      data: {
        tenantId,
        institutionId: input.institutionId,
        studentId: input.studentId,
        action: input.action,
        rollNumber: input.rollNumber,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        manualOverride: input.manualOverride ?? false,
        createdById: input.createdById,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  }

  async assignRollNumber(
    tenantId: string,
    studentId: string,
    rollNumber: string,
    options: {
      manualOverride: boolean;
      actorId?: string;
      institutionId?: string;
      action?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        academicProfile: {
          include: { admissionBatch: { include: { entrySession: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    let institutionId =
      options.institutionId ??
      student.academicProfile?.admissionBatch?.entrySession?.institutionId ??
      null;

    if (!institutionId && student.campusId) {
      const campus = await this.prisma.campus.findFirst({
        where: { id: student.campusId, tenantId },
        select: { institutionId: true },
      });
      institutionId = campus?.institutionId ?? null;
    }

    if (!institutionId) {
      throw new BadRequestException(
        'Cannot resolve institution for roll number assignment',
      );
    }

    const trimmed = rollNumber.trim();
    await this.validateRollNumberUnique(
      tenantId,
      institutionId,
      trimmed,
      studentId,
    );

    const oldValue = student.rollNumber;
    await this.prisma.student.update({
      where: { id: studentId },
      data: { rollNumber: trimmed, lastModifiedById: options.actorId },
    });

    await this.writeAuditLog(tenantId, {
      action:
        options.action ??
        (options.manualOverride ? 'MANUAL_ASSIGN' : 'GENERATE'),
      rollNumber: trimmed,
      institutionId,
      studentId,
      oldValue,
      newValue: trimmed,
      manualOverride: options.manualOverride,
      createdById: options.actorId,
      metadata: options.metadata,
    });

    return trimmed;
  }

  async syncSequencesFromExistingRolls(
    tenantId: string,
    institutionId?: string,
  ) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        rollNumber: { not: null },
        ...(institutionId
          ? {
              academicProfile: {
                admissionBatch: { entrySession: { institutionId } },
              },
            }
          : {}),
      },
      select: {
        rollNumber: true,
        campusId: true,
        academicProfile: {
          select: {
            admissionBatch: {
              select: { admissionYear: true, entrySession: true },
            },
          },
        },
      },
    });

    const maxByKey = new Map<string, number>();

    for (const s of students) {
      const roll = s.rollNumber?.trim();
      if (!roll) continue;
      const match = ROLL_PATTERN.exec(roll.toUpperCase());
      if (!match) continue;

      const [, prefix, yearSuffix, seqStr] = match;
      const admissionYear =
        s.academicProfile?.admissionBatch?.admissionYear ??
        2000 + Number.parseInt(yearSuffix, 10);
      const instId =
        s.academicProfile?.admissionBatch?.entrySession?.institutionId ??
        institutionId;
      if (!instId) continue;
      const key = `${instId}:${prefix}:${admissionYear}`;
      const seq = Number.parseInt(seqStr, 10);
      maxByKey.set(key, Math.max(maxByKey.get(key) ?? 0, seq));
    }

    let updated = 0;
    for (const [key, maxSeq] of maxByKey) {
      const [instId, prefix, yearStr] = key.split(':');
      const admissionYear = Number.parseInt(yearStr, 10);
      const nextSequence = maxSeq + 1;

      const existing = await this.prisma.rollNumberSequence.findUnique({
        where: {
          institutionId_prefix_admissionYear: {
            institutionId: instId,
            prefix,
            admissionYear,
          },
        },
      });

      await this.prisma.rollNumberSequence.upsert({
        where: {
          institutionId_prefix_admissionYear: {
            institutionId: instId,
            prefix,
            admissionYear,
          },
        },
        create: {
          tenantId,
          institutionId: instId,
          prefix,
          admissionYear,
          nextSequence,
        },
        update: {
          nextSequence: Math.max(existing?.nextSequence ?? 1, nextSequence),
        },
      });
      updated += 1;
    }

    return { synced: updated, keys: maxByKey.size };
  }

  async bulkGenerateMissing(
    tenantId: string,
    options: {
      institutionId?: string;
      admissionYear?: number;
      dryRun?: boolean;
      actorId?: string;
    },
  ) {
    const admissionBatchFilter =
      options.admissionYear || options.institutionId
        ? {
            ...(options.admissionYear
              ? { admissionYear: options.admissionYear }
              : {}),
            ...(options.institutionId
              ? { entrySession: { institutionId: options.institutionId } }
              : {}),
          }
        : undefined;

    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ rollNumber: null }, { rollNumber: '' }],
        academicProfile: {
          is: {
            streamId: { not: null },
            admissionBatchId: { not: null },
            ...(admissionBatchFilter
              ? { admissionBatch: admissionBatchFilter }
              : {}),
          },
        },
      },
      include: {
        masterProfile: { select: { fullName: true } },
        academicProfile: {
          include: {
            admissionBatch: { include: { entrySession: true } },
            stream: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const preview: Array<{
      studentId: string;
      fullName?: string;
      rollNumber: string;
      streamCode?: string;
      admissionYear?: number;
    }> = [];

    const dryRunCounters = new Map<string, number>();

    for (const student of students) {
      const profile = student.academicProfile;
      if (!profile?.streamId || !profile.admissionBatchId) continue;

      try {
        if (options.dryRun) {
          const ctx = await this.resolveContext(tenantId, {
            streamId: profile.streamId,
            admissionBatchId: profile.admissionBatchId,
          });
          const settings = await this.getSettings(tenantId);
          const counterKey = `${ctx.institutionId}:${ctx.prefix}:${ctx.admissionYear}`;
          const baseSeq = await this.readNextSequence(
            this.prisma,
            tenantId,
            ctx.institutionId,
            ctx.prefix,
            ctx.admissionYear,
          );
          const simulated = dryRunCounters.get(counterKey) ?? baseSeq;
          dryRunCounters.set(counterKey, simulated + 1);
          const rollNumber = this.formatRollNumber(
            ctx.prefix,
            ctx.yearSuffix,
            simulated,
            settings,
          );
          preview.push({
            studentId: student.id,
            fullName: student.masterProfile?.fullName?.trim() || undefined,
            rollNumber,
            streamCode: ctx.streamCode,
            admissionYear: ctx.admissionYear,
          });
        } else {
          const allocated = await this.allocateNextRollNumber(tenantId, {
            streamId: profile.streamId,
            admissionBatchId: profile.admissionBatchId,
          });
          await this.assignRollNumber(
            tenantId,
            student.id,
            allocated.rollNumber,
            {
              manualOverride: false,
              actorId: options.actorId,
              institutionId:
                profile.admissionBatch?.entrySession?.institutionId,
              action: 'BULK_GENERATE',
              metadata: {
                streamCode: allocated.streamCode,
                admissionYear: allocated.admissionYear,
                dryRun: false,
              },
            },
          );
          preview.push({
            studentId: student.id,
            fullName: student.masterProfile?.fullName?.trim() || undefined,
            rollNumber: allocated.rollNumber,
            streamCode: allocated.streamCode,
            admissionYear: allocated.admissionYear,
          });
        }
      } catch {
        // skip students that cannot resolve context
      }
    }

    return {
      preview,
      generated: options.dryRun ? 0 : preview.length,
      totalCandidates: students.length,
    };
  }
}
