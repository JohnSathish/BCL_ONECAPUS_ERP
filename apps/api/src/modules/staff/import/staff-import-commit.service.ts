import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { NormalizedStaffImportRow } from './staff-import.handler';

@Injectable()
export class StaffImportCommitService {
  constructor(private readonly prisma: PrismaService) {}

  async applyPostProfileSteps(
    tenantId: string,
    staffProfileId: string,
    row: NormalizedStaffImportRow,
    options?: { replaceEligibility?: boolean },
  ) {
    if (row.isHoD && row.departmentId) {
      await this.prisma.staffAdditionalRole.create({
        data: {
          tenantId,
          staffProfileId,
          roleCode: 'HOD',
          roleName: 'Head of Department',
          active: true,
        },
      });
      await this.prisma.department.updateMany({
        where: { id: row.departmentId, tenantId, deletedAt: null },
        data: { hodId: staffProfileId },
      });
    }

    if (row.primaryShiftId) {
      await this.prisma.staffShiftAssignment.upsert({
        where: {
          staffProfileId_shiftId: {
            staffProfileId,
            shiftId: row.primaryShiftId,
          },
        },
        create: {
          tenantId,
          staffProfileId,
          shiftId: row.primaryShiftId,
          isPrimary: true,
          active: true,
        },
        update: { isPrimary: true, active: true },
      });
    }

    if (row.staffType === 'TEACHING' && row.courseIds?.length) {
      if (options?.replaceEligibility) {
        await this.prisma.staffSubjectEligibility.deleteMany({
          where: { staffProfileId, tenantId },
        });
      }
      for (const courseId of row.courseIds) {
        await this.prisma.staffSubjectEligibility.upsert({
          where: {
            staffProfileId_courseId: { staffProfileId, courseId },
          },
          create: { tenantId, staffProfileId, courseId },
          update: {},
        });
      }
    }

    if (row.workloadLimit != null && row.staffType === 'TEACHING') {
      const academicYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { startDate: 'desc' },
        select: { id: true },
      });
      const academicYearId = academicYear?.id ?? null;
      const existing = await this.prisma.staffWorkload.findFirst({
        where: { staffProfileId, academicYearId },
      });
      const workloadData = {
        weeklyHours: new Prisma.Decimal(row.workloadLimit),
      };
      if (existing) {
        await this.prisma.staffWorkload.update({
          where: { id: existing.id },
          data: workloadData,
        });
      } else {
        await this.prisma.staffWorkload.create({
          data: {
            tenantId,
            staffProfileId,
            academicYearId,
            ...workloadData,
          },
        });
      }
    }

    if (row.qualification?.trim()) {
      const existing = await this.prisma.staffQualification.findFirst({
        where: {
          staffProfileId,
          tenantId,
          qualification: row.qualification.trim(),
        },
      });
      if (!existing) {
        await this.prisma.staffQualification.create({
          data: {
            tenantId,
            staffProfileId,
            qualification: row.qualification.trim(),
            specialization: row.specialization?.trim(),
          },
        });
      }
    }
  }
}
