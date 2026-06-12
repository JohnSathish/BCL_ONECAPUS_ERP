import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const NEP_CATEGORIES = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'] as const;

export type MigrationStepStatus = 'complete' | 'partial' | 'pending';

export type MigrationStepDto = {
  id: string;
  status: MigrationStepStatus;
  label: string;
  detail: string;
};

export type MigrationStatusDto = {
  batchCode: string;
  semesterSequence: number;
  totalStudents: number;
  steps: MigrationStepDto[];
  readyForAttendance: boolean;
  frozenCount: number;
};

@Injectable()
export class MigrationStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(
    tenantId: string,
    opts: { batchCode?: string; semesterSequence?: number } = {},
  ): Promise<MigrationStatusDto> {
    const batchCode = opts.batchCode ?? 'BATCH-2026';
    const semesterSequence = opts.semesterSequence ?? 1;

    const batch = await this.prisma.admissionBatch.findFirst({
      where: { tenantId, batchCode, deletedAt: null },
    });

    if (!batch) {
      return this.emptyStatus(
        batchCode,
        semesterSequence,
        `Admission batch ${batchCode} not found`,
      );
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        academicProfile: { admissionBatchId: batch.id },
      },
      select: {
        id: true,
        academicStanding: { select: { registrationLocked: true } },
        semesterRegistrations: {
          where: { semesterSequence },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            lines: { select: { category: true } },
          },
        },
      },
    });

    const totalStudents = students.length;

    const withRegistration = students.filter(
      (s) => (s.semesterRegistrations[0]?.lines.length ?? 0) > 0,
    ).length;

    const withFullNep = students.filter((s) => {
      const lines = s.semesterRegistrations[0]?.lines ?? [];
      const cats = new Set(lines.map((l) => l.category.toUpperCase()));
      return NEP_CATEGORIES.every((c) => cats.has(c));
    }).length;

    const frozenCount = students.filter(
      (s) => s.academicStanding?.registrationLocked === true,
    ).length;

    const publishedPlan = await this.prisma.timetablePlan.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        name: { contains: 'Arts', mode: 'insensitive' },
      },
      select: { name: true },
    });

    const steps: MigrationStepDto[] = [
      this.step(
        'students',
        'Import students + NEP papers',
        totalStudents,
        totalStudents || 1,
        'Upload admission Excel in Sem 1 Migration Studio',
      ),
      this.step(
        'compulsory',
        'Generate compulsory registrations',
        withRegistration,
        totalStudents || 1,
        'Generate registrations for the batch',
      ),
      this.step(
        'subjects',
        'Import subject selections',
        withFullNep,
        totalStudents || 1,
        'Ensure all 6 NEP categories are assigned per student',
      ),
      {
        id: 'timetable',
        status: publishedPlan ? 'complete' : 'pending',
        label: 'Publish section-aware timetable',
        detail: publishedPlan
          ? publishedPlan.name
          : 'Publish Arts ODD timetable plan',
      },
      this.step(
        'freeze',
        'Freeze and hand off',
        frozenCount,
        totalStudents || 1,
        'Freeze registration when allocations are final',
      ),
    ];

    return {
      batchCode,
      semesterSequence,
      totalStudents,
      steps,
      frozenCount,
      readyForAttendance:
        totalStudents > 0 &&
        frozenCount >= totalStudents &&
        withFullNep >= totalStudents &&
        Boolean(publishedPlan),
    };
  }

  private emptyStatus(
    batchCode: string,
    semesterSequence: number,
    detail: string,
  ): MigrationStatusDto {
    const pending = (id: string, label: string): MigrationStepDto => ({
      id,
      status: 'pending',
      label,
      detail,
    });
    return {
      batchCode,
      semesterSequence,
      totalStudents: 0,
      frozenCount: 0,
      readyForAttendance: false,
      steps: [
        pending('students', 'Import students + NEP papers'),
        pending('compulsory', 'Generate compulsory registrations'),
        pending('subjects', 'Import subject selections'),
        pending('timetable', 'Publish section-aware timetable'),
        pending('freeze', 'Freeze and hand off'),
      ],
    };
  }

  private step(
    id: string,
    label: string,
    done: number,
    total: number,
    pendingDetail: string,
  ): MigrationStepDto {
    if (total === 0 || done === 0) {
      return { id, status: 'pending', label, detail: pendingDetail };
    }
    if (done >= total) {
      return {
        id,
        status: 'complete',
        label,
        detail: `${done}/${total} ready`,
      };
    }
    return { id, status: 'partial', label, detail: `${done}/${total} ready` };
  }
}
