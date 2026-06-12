import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  cycleTypeFromSemesterNumber,
  MAX_FYUGP_SEMESTER,
} from '../utils/cycle.util';

@Injectable()
export class BatchSemesterMappingService {
  constructor(private readonly prisma: PrismaService) {}

  listForInstitution(tenantId: string, institutionId: string) {
    return this.prisma.batchSemesterMapping.findMany({
      where: { tenantId, institutionId },
      include: {
        admissionBatch: { include: { entrySession: true } },
        calendarSemester: true,
      },
      orderBy: [{ admissionBatch: { admissionYear: 'desc' } }],
    });
  }

  async syncMappingForBatch(tenantId: string, batchId: string) {
    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: batchId, tenantId, deletedAt: null },
    });
    if (!batch) throw new NotFoundException('Admission batch not found');
    const calendarSemester = await this.resolveCalendarSemester(
      tenantId,
      batch.institutionId,
      batch.currentSemester,
    );

    const cycleType = cycleTypeFromSemesterNumber(batch.currentSemester);

    return this.prisma.batchSemesterMapping.upsert({
      where: { admissionBatchId: batchId },
      create: {
        tenantId,
        institutionId: batch.institutionId,
        admissionBatchId: batchId,
        semesterNumber: batch.currentSemester,
        calendarSemesterId: calendarSemester?.id ?? null,
        cycleType,
        isActive: batch.isActive && batch.currentSemester <= MAX_FYUGP_SEMESTER,
      },
      update: {
        semesterNumber: batch.currentSemester,
        calendarSemesterId: calendarSemester?.id ?? null,
        cycleType,
        isActive: batch.isActive && batch.currentSemester <= MAX_FYUGP_SEMESTER,
      },
      include: {
        admissionBatch: true,
        calendarSemester: true,
      },
    });
  }

  async resolveCalendarSemester(
    tenantId: string,
    institutionId: string,
    semesterNumber: number,
  ) {
    if (semesterNumber < 1 || semesterNumber > MAX_FYUGP_SEMESTER) {
      return null;
    }

    return this.prisma.semester.findFirst({
      where: {
        tenantId,
        institutionId,
        semesterNumber,
        deletedAt: null,
      },
      include: { academicYear: true },
    });
  }

  async getStudentCountBySemester(tenantId: string, institutionId: string) {
    const batches = await this.prisma.admissionBatch.findMany({
      where: { tenantId, institutionId, deletedAt: null, isActive: true },
      include: { _count: { select: { studentProfiles: true } } },
    });

    const bySemester = new Map<number, number>();
    for (const batch of batches) {
      const current = bySemester.get(batch.currentSemester) ?? 0;
      bySemester.set(
        batch.currentSemester,
        current + batch._count.studentProfiles,
      );
    }
    return bySemester;
  }

  async freezeMappingsForCycle(
    tenantId: string,
    institutionId: string,
    cycleType: 'ODD' | 'EVEN',
  ) {
    await this.prisma.batchSemesterMapping.updateMany({
      where: {
        tenantId,
        institutionId,
        cycleType,
        isActive: true,
      },
      data: {
        isActive: false,
        frozenAt: new Date(),
      },
    });
  }
}
