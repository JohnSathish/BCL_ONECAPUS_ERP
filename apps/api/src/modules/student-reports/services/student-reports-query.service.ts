import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { DataScopeService } from '../../../common/permissions/data-scope.service';
import { PrismaService } from '../../../database/prisma.service';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';

const ACTIVE_STATUSES = ['STUDYING', 'ACTIVE'];

@Injectable()
export class StudentReportsQueryService {
  constructor(
    readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  buildWhere(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Prisma.StudentWhereInput {
    let where: Prisma.StudentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(filters.campusId ? { campusId: filters.campusId } : {}),
      ...(filters.programVersionId
        ? { programVersionId: filters.programVersionId }
        : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
    };

    if (filters.semester) {
      where = {
        ...where,
        academicStanding: { currentSemesterSequence: filters.semester },
      };
    }

    if (filters.streamId || filters.batchId || filters.academicYear) {
      where = {
        ...where,
        academicProfile: {
          ...(filters.streamId ? { streamId: filters.streamId } : {}),
          ...(filters.batchId ? { admissionBatchId: filters.batchId } : {}),
          ...(filters.academicYear
            ? {
                admissionBatch: {
                  entrySession: {
                    name: {
                      contains: filters.academicYear,
                      mode: 'insensitive',
                    },
                  },
                },
              }
            : {}),
        },
      };
    }

    const profileFilter: Prisma.StudentProfileWhereInput = {};
    if (filters.admissionStatus)
      profileFilter.admissionStatus = filters.admissionStatus;
    if (filters.studentStatus)
      profileFilter.studentStatus = filters.studentStatus;
    if (filters.gender) profileFilter.gender = filters.gender;
    if (filters.categoryLookupId)
      profileFilter.categoryLookupId = filters.categoryLookupId;
    if (filters.religionLookupId)
      profileFilter.religionLookupId = filters.religionLookupId;
    if (filters.bloodGroupLookupId)
      profileFilter.bloodGroupLookupId = filters.bloodGroupLookupId;
    if (Object.keys(profileFilter).length) {
      where = { ...where, masterProfile: profileFilter };
    }

    if (filters.state || filters.district) {
      where = {
        ...where,
        addresses: {
          some: {
            ...(filters.state
              ? { state: { equals: filters.state, mode: 'insensitive' } }
              : {}),
            ...(filters.district
              ? { district: { equals: filters.district, mode: 'insensitive' } }
              : {}),
          },
        },
      };
    }

    if (filters.studentIds?.length) {
      where = { ...where, id: { in: filters.studentIds } };
    }

    if (user) {
      where = this.dataScope.applyStudentListScope(where, user);
    }

    return where;
  }

  async countStudents(where: Prisma.StudentWhereInput) {
    return this.prisma.student.count({ where });
  }

  async countActive(where: Prisma.StudentWhereInput) {
    const profileFilter: Prisma.StudentProfileWhereInput = {
      studentStatus: { in: ACTIVE_STATUSES },
    };
    if (
      where.masterProfile &&
      typeof where.masterProfile === 'object' &&
      !('is' in where.masterProfile)
    ) {
      Object.assign(profileFilter, where.masterProfile);
    }
    return this.prisma.student.count({
      where: {
        ...where,
        masterProfile: profileFilter,
      },
    });
  }

  async loadLookupMap(tenantId: string, lookupType: string) {
    const rows = await this.prisma.masterLookup.findMany({
      where: { tenantId, lookupType, isActive: true },
      select: { id: true, label: true, code: true },
    });
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  pct(count: number, total: number) {
    return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
  }

  toBuckets(
    map: Map<string, number>,
    total: number,
    labelFn?: (k: string) => string,
  ) {
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: labelFn ? labelFn(key) : key,
        count,
        percentage: this.pct(count, total),
      }));
  }
}
