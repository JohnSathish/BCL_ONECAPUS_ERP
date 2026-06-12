import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  cycleTypeFromSemesterNumber,
  MAX_FYUGP_SEMESTER,
} from '../utils/cycle.util';
import type {
  CreateAdmissionBatchDto,
  UpdateAdmissionBatchDto,
} from '../dto/academic-lifecycle.dto';
import { BatchSemesterMappingService } from './batch-semester-mapping.service';

@Injectable()
export class AdmissionBatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingService: BatchSemesterMappingService,
  ) {}

  list(tenantId: string, institutionId: string) {
    return this.prisma.admissionBatch.findMany({
      where: { tenantId, institutionId, deletedAt: null },
      include: {
        entrySession: true,
        semesterMapping: { include: { calendarSemester: true } },
        _count: { select: { studentProfiles: true } },
      },
      orderBy: [{ admissionYear: 'desc' }, { batchCode: 'asc' }],
    });
  }

  async get(tenantId: string, batchId: string) {
    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: batchId, tenantId, deletedAt: null },
      include: {
        entrySession: true,
        semesterMapping: { include: { calendarSemester: true } },
        _count: { select: { studentProfiles: true } },
      },
    });
    if (!batch) throw new NotFoundException('Admission batch not found');
    return batch;
  }

  async create(
    tenantId: string,
    institutionId: string,
    dto: CreateAdmissionBatchDto,
  ) {
    if (dto.currentSemester < 1 || dto.currentSemester > MAX_FYUGP_SEMESTER) {
      throw new BadRequestException(
        `currentSemester must be between 1 and ${MAX_FYUGP_SEMESTER}`,
      );
    }

    const entrySession = await this.prisma.academicYear.findFirst({
      where: {
        id: dto.entrySessionId,
        tenantId,
        institutionId,
        deletedAt: null,
      },
    });
    if (!entrySession) {
      throw new BadRequestException('Entry academic session not found');
    }

    const existing = await this.prisma.admissionBatch.findFirst({
      where: {
        institutionId,
        batchCode: dto.batchCode,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('Batch code already exists');
    }

    const cycleType = cycleTypeFromSemesterNumber(dto.currentSemester);

    const batch = await this.prisma.admissionBatch.create({
      data: {
        tenantId,
        institutionId,
        batchCode: dto.batchCode,
        admissionYear: dto.admissionYear,
        entrySessionId: dto.entrySessionId,
        currentSemester: dto.currentSemester,
        cycleType,
        promotionStatus: 'IDLE',
        isActive: dto.isActive ?? true,
      },
    });

    await this.mappingService.syncMappingForBatch(tenantId, batch.id);

    return this.get(tenantId, batch.id);
  }

  async update(
    tenantId: string,
    batchId: string,
    dto: UpdateAdmissionBatchDto,
  ) {
    const batch = await this.get(tenantId, batchId);

    if (
      dto.currentSemester !== undefined &&
      (dto.currentSemester < 1 || dto.currentSemester > MAX_FYUGP_SEMESTER)
    ) {
      throw new BadRequestException(
        `currentSemester must be between 1 and ${MAX_FYUGP_SEMESTER}`,
      );
    }

    const currentSemester = dto.currentSemester ?? batch.currentSemester;
    const cycleType = cycleTypeFromSemesterNumber(currentSemester);

    await this.prisma.admissionBatch.update({
      where: { id: batchId },
      data: {
        ...(dto.batchCode !== undefined ? { batchCode: dto.batchCode } : {}),
        ...(dto.admissionYear !== undefined
          ? { admissionYear: dto.admissionYear }
          : {}),
        ...(dto.entrySessionId !== undefined
          ? { entrySessionId: dto.entrySessionId }
          : {}),
        ...(dto.currentSemester !== undefined
          ? { currentSemester: dto.currentSemester }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.promotionStatus !== undefined
          ? { promotionStatus: dto.promotionStatus }
          : {}),
        cycleType,
      },
    });

    if (dto.currentSemester !== undefined) {
      await this.mappingService.syncMappingForBatch(tenantId, batchId);
    }

    return this.get(tenantId, batchId);
  }

  async resolveBatchForEnrollment(
    tenantId: string,
    institutionId: string,
    entrySessionId: string,
    admissionYear: number,
  ) {
    let batch = await this.prisma.admissionBatch.findFirst({
      where: {
        tenantId,
        institutionId,
        entrySessionId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!batch) {
      batch = await this.prisma.admissionBatch.findFirst({
        where: {
          tenantId,
          institutionId,
          admissionYear,
          deletedAt: null,
          isActive: true,
        },
      });
    }

    if (!batch) {
      const batchCode = `BATCH-${admissionYear}`;
      batch = await this.prisma.admissionBatch.create({
        data: {
          tenantId,
          institutionId,
          batchCode,
          admissionYear,
          entrySessionId,
          currentSemester: 1,
          cycleType: 'ODD',
          promotionStatus: 'IDLE',
          isActive: true,
        },
      });
      await this.mappingService.syncMappingForBatch(tenantId, batch.id);
    }

    return batch;
  }

  async advanceBatchAfterPromotion(
    tenantId: string,
    batchId: string,
    toSemester: number,
  ) {
    const cycleType = cycleTypeFromSemesterNumber(toSemester);
    const promotionStatus =
      toSemester >= MAX_FYUGP_SEMESTER ? 'FROZEN' : 'IDLE';

    await this.prisma.admissionBatch.update({
      where: { id: batchId },
      data: {
        currentSemester: toSemester,
        cycleType,
        promotionStatus,
      },
    });

    await this.mappingService.syncMappingForBatch(tenantId, batchId);
  }

  async backfillFromProfiles(tenantId: string, institutionId: string) {
    const campusIds = (
      await this.prisma.campus.findMany({
        where: { tenantId, institutionId, deletedAt: null },
        select: { id: true },
      })
    ).map((c) => c.id);

    const profiles = await this.prisma.studentAcademicProfile.findMany({
      where: {
        tenantId,
        admissionYearId: { not: null },
        student: {
          deletedAt: null,
          ...(campusIds.length > 0 ? { campusId: { in: campusIds } } : {}),
        },
      },
      include: {
        student: {
          include: {
            academicStanding: true,
          },
        },
      },
    });

    const grouped = new Map<
      string,
      { admissionYearId: string; sequences: number[] }
    >();

    for (const profile of profiles) {
      if (!profile.admissionYearId) continue;
      const key = profile.admissionYearId;
      const entry = grouped.get(key) ?? {
        admissionYearId: key,
        sequences: [],
      };
      const seq =
        profile.student.academicStanding?.currentSemesterSequence ?? 1;
      entry.sequences.push(seq);
      grouped.set(key, entry);
    }

    const created: string[] = [];

    for (const [, group] of grouped) {
      const session = await this.prisma.academicYear.findFirst({
        where: { id: group.admissionYearId, tenantId, institutionId },
      });
      if (!session) continue;

      const admissionYear = session.startDate.getFullYear();
      const modeSemester = this.mode(group.sequences) ?? 1;
      const batchCode = `BATCH-${admissionYear}`;

      let batch = await this.prisma.admissionBatch.findFirst({
        where: { institutionId, batchCode, deletedAt: null },
      });

      if (!batch) {
        batch = await this.prisma.admissionBatch.create({
          data: {
            tenantId,
            institutionId,
            batchCode,
            admissionYear,
            entrySessionId: group.admissionYearId,
            currentSemester: modeSemester,
            cycleType: cycleTypeFromSemesterNumber(modeSemester),
            promotionStatus: 'IDLE',
            isActive: true,
          },
        });
        created.push(batch.id);
      } else {
        await this.prisma.admissionBatch.update({
          where: { id: batch.id },
          data: {
            currentSemester: modeSemester,
            cycleType: cycleTypeFromSemesterNumber(modeSemester),
          },
        });
      }

      await this.mappingService.syncMappingForBatch(tenantId, batch.id);

      await this.prisma.studentAcademicProfile.updateMany({
        where: {
          tenantId,
          admissionYearId: group.admissionYearId,
          admissionBatchId: null,
        },
        data: { admissionBatchId: batch.id },
      });
    }

    return { batchesProcessed: grouped.size, batchesCreated: created.length };
  }

  private mode(values: number[]): number | null {
    if (values.length === 0) return null;
    const counts = new Map<number, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best = values[0];
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  }
}
