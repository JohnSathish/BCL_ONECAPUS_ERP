import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  evaluateRollEligibility,
  isTestOrDummyRecord,
  issueLabel,
} from './roll-number-eligibility';
import { RollShiftRangeService } from './roll-shift-range.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly rollShiftRange: RollShiftRangeService,
  ) {}

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
    input: { streamId: string; admissionBatchId: string; shiftId?: string },
  ): Promise<RollNumberPreview> {
    const ctx = await this.resolveContext(tenantId, input);
    const settings = await this.getSettings(tenantId);

    return this.prisma.$transaction(async (tx) => {
      if (input.shiftId) {
        const shiftAllocated = await this.rollShiftRange.allocateInShiftRange(
          tx,
          tenantId,
          {
            institutionId: ctx.institutionId,
            shiftId: input.shiftId,
            admissionYear: ctx.admissionYear,
            prefix: ctx.prefix,
            yearSuffix: ctx.yearSuffix,
            streamCode: ctx.streamCode,
            settings,
          },
        );
        if (shiftAllocated) {
          await this.validateRollNumberUniqueTx(
            tx,
            tenantId,
            ctx.institutionId,
            shiftAllocated.rollNumber,
          );
          return shiftAllocated;
        }
      }

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
      departmentId?: string;
      streamId?: string;
      semesterNo?: number;
      dryRun?: boolean;
      actorId?: string;
      excludeStudentIds?: string[];
    },
  ) {
    const exclude = new Set(options.excludeStudentIds ?? []);
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

    const academicProfileWhere = {
      streamId: options.streamId ? options.streamId : { not: null },
      admissionBatchId: { not: null },
      ...(admissionBatchFilter ? { admissionBatch: admissionBatchFilter } : {}),
    };

    const scopeWhere = {
      tenantId,
      deletedAt: null,
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
      academicProfile: { is: academicProfileWhere },
      ...(options.semesterNo
        ? {
            academicStanding: {
              is: { currentSemesterSequence: options.semesterNo },
            },
          }
        : {}),
    };

    const alreadyAssigned = await this.prisma.student.count({
      where: {
        ...scopeWhere,
        rollNumber: { not: null },
        NOT: { rollNumber: '' },
      },
    });

    const students = await this.prisma.student.findMany({
      where: {
        ...scopeWhere,
        OR: [{ rollNumber: null }, { rollNumber: '' }],
      },
      include: {
        masterProfile: {
          select: {
            fullName: true,
            gender: true,
            studentStatus: true,
            admissionStatus: true,
            photoPath: true,
          },
        },
        department: { select: { id: true, name: true, code: true } },
        programVersion: {
          include: {
            program: { select: { id: true, name: true, code: true } },
          },
        },
        academicProfile: {
          include: {
            admissionBatch: { include: { entrySession: true } },
            stream: true,
          },
        },
        academicStanding: { select: { currentSemesterSequence: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const settings = await this.getSettings(tenantId);
    const dryRunCounters = new Map<string, number>();
    const previewRows: Array<Record<string, unknown>> = [];
    const attention: Array<{
      studentId: string;
      fullName?: string;
      reasons: string[];
    }> = [];

    for (const student of students) {
      const profile = student.academicProfile;
      const batch = profile?.admissionBatch;
      const fullName = student.masterProfile?.fullName?.trim() || undefined;

      const eligibility = evaluateRollEligibility({
        fullName,
        applicationNumber: student.applicationNumber,
        enrollmentNumber: student.enrollmentNumber,
        importSource: student.importSource,
        admissionSource: student.admissionSource,
        programmeId: student.programVersionId,
        departmentId: student.departmentId,
        admissionYear: batch?.admissionYear,
        admissionStatus: student.masterProfile?.admissionStatus,
        studentStatus: student.masterProfile?.studentStatus,
        streamId: profile?.streamId,
        admissionBatchId: profile?.admissionBatchId,
      });

      let generationStatus: 'READY' | 'BLOCKED' | 'SKIPPED' = 'READY';
      let newRollNumber: string | undefined;
      let contextError: string | undefined;
      const remarks = [...eligibility.remarks];

      if (exclude.has(student.id)) {
        generationStatus = 'SKIPPED';
        remarks.push('Excluded by admin');
      } else if (eligibility.blocked) {
        generationStatus = 'BLOCKED';
        attention.push({
          studentId: student.id,
          fullName,
          reasons: eligibility.remarks,
        });
      } else if (profile?.streamId && profile.admissionBatchId) {
        try {
          const ctx = await this.resolveContext(tenantId, {
            streamId: profile.streamId,
            admissionBatchId: profile.admissionBatchId,
          });
          const institutionId =
            profile.admissionBatch?.entrySession?.institutionId;
          const shiftId = student.primaryShiftId ?? undefined;
          let simulated: number;

          if (shiftId && institutionId) {
            const shiftRangesActive =
              await this.rollShiftRange.hasActiveShiftRanges(
                tenantId,
                institutionId,
                ctx.admissionYear,
              );
            if (shiftRangesActive && !shiftId) {
              throw new BadRequestException(
                'Primary shift required when shift roll ranges are configured',
              );
            }
            const shiftConfig = await this.rollShiftRange.findShiftConfig(
              this.prisma,
              tenantId,
              institutionId,
              shiftId,
              ctx.admissionYear,
            );
            if (shiftConfig) {
              const counterKey = `shift:${institutionId}:${shiftId}:${ctx.admissionYear}`;
              const baseSeq = shiftConfig.nextSequence;
              simulated = dryRunCounters.get(counterKey) ?? baseSeq;
              dryRunCounters.set(counterKey, simulated + 1);
            } else {
              const counterKey = `${ctx.institutionId}:${ctx.prefix}:${ctx.admissionYear}`;
              const baseSeq = await this.readNextSequence(
                this.prisma,
                tenantId,
                ctx.institutionId,
                ctx.prefix,
                ctx.admissionYear,
              );
              simulated = dryRunCounters.get(counterKey) ?? baseSeq;
              dryRunCounters.set(counterKey, simulated + 1);
            }
          } else {
            const counterKey = `${ctx.institutionId}:${ctx.prefix}:${ctx.admissionYear}`;
            const baseSeq = await this.readNextSequence(
              this.prisma,
              tenantId,
              ctx.institutionId,
              ctx.prefix,
              ctx.admissionYear,
            );
            simulated = dryRunCounters.get(counterKey) ?? baseSeq;
            dryRunCounters.set(counterKey, simulated + 1);
          }

          newRollNumber = this.formatRollNumber(
            ctx.prefix,
            ctx.yearSuffix,
            simulated,
            settings,
          );
        } catch (err) {
          generationStatus = 'BLOCKED';
          contextError =
            err instanceof Error
              ? err.message
              : 'Roll context could not be resolved';
          remarks.push(contextError);
          attention.push({
            studentId: student.id,
            fullName,
            reasons: [contextError],
          });
        }
      }

      previewRows.push({
        studentId: student.id,
        photoPath: student.masterProfile?.photoPath ?? null,
        fullName,
        applicationNumber: student.applicationNumber,
        admissionNumber: student.admissionNumber,
        programme: student.programVersion?.program?.name,
        programmeCode: student.programVersion?.program?.code,
        department: student.department?.name,
        departmentCode: student.department?.code,
        batch: batch?.batchCode ?? String(batch?.admissionYear ?? ''),
        semester:
          student.academicStanding?.currentSemesterSequence ??
          batch?.admissionYear ??
          null,
        gender: student.masterProfile?.gender,
        currentRollNumber: student.rollNumber,
        newRollNumber,
        streamCode: profile?.stream?.code,
        admissionYear: batch?.admissionYear,
        generationStatus,
        remarks,
        issues: eligibility.issues,
      });
    }

    const rollCounts = new Map<string, number>();
    for (const row of previewRows) {
      const roll = row.newRollNumber as string | undefined;
      if (roll) rollCounts.set(roll, (rollCounts.get(roll) ?? 0) + 1);
    }
    for (const row of previewRows) {
      const roll = row.newRollNumber as string | undefined;
      if (roll && (rollCounts.get(roll) ?? 0) > 1) {
        if (row.generationStatus === 'READY') {
          row.generationStatus = 'BLOCKED';
          const remarks = row.remarks as string[];
          remarks.push('Duplicate roll number in preview');
          attention.push({
            studentId: row.studentId as string,
            fullName: row.fullName as string | undefined,
            reasons: ['Duplicate roll number in preview'],
          });
        }
      }
    }

    const readyRows = previewRows.filter((r) => r.generationStatus === 'READY');
    const blockedRows = previewRows.filter(
      (r) => r.generationStatus === 'BLOCKED',
    );
    const testRecords = previewRows.filter((r) =>
      (r.issues as string[] | undefined)?.includes('TEST_RECORD'),
    ).length;

    const patternSamples: string[] = [];
    const expectedNextByPrefix: Array<{
      prefix: string;
      yearSuffix: string;
      nextSequence: number;
      sample: string;
    }> = [];
    for (const [key, seq] of dryRunCounters) {
      const [, prefix, year] = key.split(':');
      const yearSuffix = String(year).slice(-2);
      const sample = this.formatRollNumber(prefix, yearSuffix, seq, settings);
      patternSamples.push(sample);
      expectedNextByPrefix.push({
        prefix,
        yearSuffix,
        nextSequence: seq,
        sample,
      });
    }

    const warnings: string[] = [];
    if (testRecords > 0) {
      warnings.push(
        `${testRecords} test record(s) detected — excluded from generation`,
      );
    }
    const dupCount = previewRows.filter((r) =>
      (r.remarks as string[])?.some((x) => x.includes('Duplicate')),
    ).length;
    if (dupCount > 0)
      warnings.push(`${dupCount} duplicate roll number(s) in preview`);

    let generated = 0;
    const generatedRolls: string[] = [];

    if (!options.dryRun) {
      for (const row of readyRows) {
        const student = students.find((s) => s.id === row.studentId);
        const profile = student?.academicProfile;
        if (!profile?.streamId || !profile.admissionBatchId) continue;
        try {
          const allocated = await this.allocateNextRollNumber(tenantId, {
            streamId: profile.streamId,
            admissionBatchId: profile.admissionBatchId,
            shiftId: student?.primaryShiftId ?? undefined,
          });
          await this.assignRollNumber(
            tenantId,
            student!.id,
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
          row.newRollNumber = allocated.rollNumber;
          generatedRolls.push(allocated.rollNumber);
          generated += 1;
        } catch {
          row.generationStatus = 'BLOCKED';
          (row.remarks as string[]).push('Generation failed');
        }
      }

      if (generated > 0 && options.actorId) {
        const batchNo =
          (await this.prisma.studentRollNumberAuditLog.count({
            where: { tenantId, action: 'BULK_GENERATE_BATCH' },
          })) + 1;
        await this.writeAuditLog(tenantId, {
          action: 'BULK_GENERATE_BATCH',
          rollNumber: generatedRolls[0] ?? 'BATCH',
          institutionId: options.institutionId,
          createdById: options.actorId,
          metadata: {
            batchNumber: batchNo,
            generated,
            admissionYear: options.admissionYear,
            departmentId: options.departmentId,
            streamId: options.streamId,
            semesterNo: options.semesterNo,
            firstRollNumber: generatedRolls[0],
            lastRollNumber: generatedRolls[generatedRolls.length - 1],
            excludedCount: exclude.size,
            blockedCount: blockedRows.length,
          },
        });
      }
    }

    return {
      preview: previewRows,
      blocked: blockedRows,
      attention,
      summary: {
        totalFound: students.length + alreadyAssigned,
        candidatesWithoutRoll: students.length,
        alreadyAssigned,
        ready: readyRows.length,
        blocked: blockedRows.length,
        skipped: previewRows.filter((r) => r.generationStatus === 'SKIPPED')
          .length,
        testRecords,
        missingData: previewRows.filter((r) =>
          (r.issues as string[] | undefined)?.some((i) =>
            [
              'MISSING_NAME',
              'MISSING_PROGRAMME',
              'MISSING_DEPARTMENT',
              'MISSING_ACADEMIC_YEAR',
            ].includes(i),
          ),
        ).length,
        duplicatesDetected: dupCount,
        errors: blockedRows.filter((r) =>
          (r.remarks as string[])?.some(
            (x) => x.includes('failed') || x.includes('context'),
          ),
        ).length,
      },
      analysis: {
        warnings,
        patternSamples: patternSamples.slice(0, 10),
        expectedNextByPrefix,
        patternDescription: `${settings.separator ? 'Prefix + YY + separator + sequence' : 'Prefix + YY + sequence'}`,
      },
      generated: options.dryRun ? 0 : generated,
      totalCandidates: students.length,
      audit:
        generatedRolls.length > 0
          ? {
              firstRollNumber: generatedRolls[0],
              lastRollNumber: generatedRolls[generatedRolls.length - 1],
              studentsGenerated: generated,
            }
          : undefined,
    };
  }

  async scanStudentDataCleanup(tenantId: string) {
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        masterProfile: { select: { fullName: true, admissionStatus: true } },
        department: { select: { name: true } },
        programVersion: { include: { program: { select: { name: true } } } },
      },
      take: 5000,
    });

    const categories = {
      testRecords: [] as Array<{
        studentId: string;
        fullName?: string;
        reason: string;
      }>,
      duplicateNames: [] as Array<{
        name: string;
        count: number;
        studentIds: string[];
      }>,
      missingProgrammes: [] as Array<{ studentId: string; fullName?: string }>,
      missingDepartments: [] as Array<{ studentId: string; fullName?: string }>,
      invalidAdmissionNumbers: [] as Array<{
        studentId: string;
        fullName?: string;
        value: string;
      }>,
      duplicateRollNumbers: [] as Array<{ rollNumber: string; count: number }>,
    };

    const nameMap = new Map<string, string[]>();
    const rollMap = new Map<string, number>();

    for (const s of students) {
      const fullName = s.masterProfile?.fullName?.trim();
      if (
        isTestOrDummyRecord({
          fullName,
          applicationNumber: s.applicationNumber,
          enrollmentNumber: s.enrollmentNumber,
          importSource: s.importSource,
          admissionSource: s.admissionSource,
        })
      ) {
        categories.testRecords.push({
          studentId: s.id,
          fullName,
          reason: issueLabel('TEST_RECORD'),
        });
      }
      if (!s.programVersionId) {
        categories.missingProgrammes.push({ studentId: s.id, fullName });
      }
      if (!s.departmentId) {
        categories.missingDepartments.push({ studentId: s.id, fullName });
      }
      if (s.admissionNumber && !/^[A-Za-z0-9/-]+$/.test(s.admissionNumber)) {
        categories.invalidAdmissionNumbers.push({
          studentId: s.id,
          fullName,
          value: s.admissionNumber,
        });
      }
      if (fullName) {
        const key = fullName.toLowerCase();
        if (!nameMap.has(key)) nameMap.set(key, []);
        nameMap.get(key)!.push(s.id);
      }
      if (s.rollNumber?.trim()) {
        const r = s.rollNumber.trim();
        rollMap.set(r, (rollMap.get(r) ?? 0) + 1);
      }
    }

    for (const [name, ids] of nameMap) {
      if (ids.length > 1) {
        categories.duplicateNames.push({
          name,
          count: ids.length,
          studentIds: ids,
        });
      }
    }
    for (const [rollNumber, count] of rollMap) {
      if (count > 1)
        categories.duplicateRollNumbers.push({ rollNumber, count });
    }

    return {
      scanned: students.length,
      categories,
      totals: {
        testRecords: categories.testRecords.length,
        duplicateNames: categories.duplicateNames.length,
        missingProgrammes: categories.missingProgrammes.length,
        missingDepartments: categories.missingDepartments.length,
        invalidAdmissionNumbers: categories.invalidAdmissionNumbers.length,
        duplicateRollNumbers: categories.duplicateRollNumbers.length,
      },
    };
  }

  async getSequenceOverview(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const sequences = await this.prisma.rollNumberSequence.findMany({
      where: { tenantId },
      orderBy: [{ admissionYear: 'desc' }, { prefix: 'asc' }],
    });

    const rows = [];
    for (const seq of sequences) {
      const yearSuffix = String(seq.admissionYear).slice(-2);
      const rollPrefix = `${seq.prefix}${yearSuffix}`;
      const [lastStudent, totalGenerated] = await Promise.all([
        this.prisma.student.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            rollNumber: { startsWith: rollPrefix },
          },
          select: { rollNumber: true },
          orderBy: { rollNumber: 'desc' },
        }),
        this.prisma.student.count({
          where: {
            tenantId,
            deletedAt: null,
            rollNumber: { startsWith: rollPrefix },
          },
        }),
      ]);

      rows.push({
        prefix: seq.prefix,
        admissionYear: seq.admissionYear,
        currentSequence: Math.max(0, seq.nextSequence - 1),
        nextSequence: seq.nextSequence,
        nextRollNumber: this.formatRollNumber(
          seq.prefix,
          yearSuffix,
          seq.nextSequence,
          settings,
        ),
        lastGeneratedRollNumber: lastStudent?.rollNumber ?? null,
        totalGenerated,
      });
    }
    return rows;
  }

  async listGenerationHistory(tenantId: string, take = 50) {
    const logs = await this.prisma.studentRollNumberAuditLog.findMany({
      where: { tenantId, action: 'BULK_GENERATE_BATCH' },
      orderBy: { generatedAt: 'desc' },
      take,
      include: {
        createdBy: { select: { displayName: true, email: true } },
      },
    });

    const total = await this.prisma.studentRollNumberAuditLog.count({
      where: { tenantId, action: 'BULK_GENERATE_BATCH' },
    });

    return logs.map((log, index) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      return {
        id: log.id,
        batchNumber: (meta.batchNumber as number | undefined) ?? total - index,
        generatedAt: log.generatedAt,
        generatedBy:
          log.createdBy?.displayName ?? log.createdBy?.email ?? 'System',
        admissionYear: meta.admissionYear ?? null,
        studentsProcessed: Number(meta.generated ?? 0),
        firstRollNumber: meta.firstRollNumber ?? null,
        lastRollNumber: meta.lastRollNumber ?? null,
        blockedCount: Number(meta.blockedCount ?? 0),
        excludedCount: Number(meta.excludedCount ?? 0),
        departmentId: meta.departmentId ?? null,
        streamId: meta.streamId ?? null,
        semesterNo: meta.semesterNo ?? null,
      };
    });
  }
}
