import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ActivateSemesterDto } from '../dto/academic-lifecycle.dto';

@Injectable()
export class ActiveSemesterService {
  constructor(private readonly prisma: PrismaService) {}

  async activate(
    tenantId: string,
    semesterId: string,
    dto: ActivateSemesterDto,
    activatedById?: string,
  ) {
    const sem = await this.prisma.semester.findFirst({
      where: { id: semesterId, tenantId, deletedAt: null },
    });
    if (!sem) throw new NotFoundException('Semester not found');
    if (sem.status === 'FROZEN') {
      throw new BadRequestException('Cannot activate a frozen semester');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.semester.update({
        where: { id: semesterId },
        data: {
          isActive: true,
          status: 'ACTIVE',
          registrationOpen: true,
          attendanceEnabled: true,
          examinationEnabled: true,
          timetableEnabled: true,
          feeCycleEnabled: true,
          resultProcessingEnabled: true,
        },
      });

      await tx.campusShiftActiveSemester.upsert({
        where: {
          institutionId_campusId_shiftId_semesterId: {
            institutionId: sem.institutionId,
            campusId: dto.campusId,
            shiftId: dto.shiftId,
            semesterId,
          },
        },
        create: {
          tenantId,
          institutionId: sem.institutionId,
          campusId: dto.campusId,
          shiftId: dto.shiftId,
          semesterId,
          activatedById: activatedById ?? null,
        },
        update: {
          activatedAt: new Date(),
          activatedById: activatedById ?? null,
        },
      });
    });

    return this.prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        academicYear: true,
        campusShiftActiveSemesters: {
          where: { campusId: dto.campusId, shiftId: dto.shiftId },
        },
      },
    });
  }

  async getActiveForScope(
    tenantId: string,
    institutionId: string,
    campusId: string,
    shiftId: string,
  ) {
    const rows = await this.prisma.campusShiftActiveSemester.findMany({
      where: {
        institutionId,
        campusId,
        shiftId,
        tenantId,
      },
      include: { semester: { include: { academicYear: true } } },
      orderBy: { semester: { semesterNumber: 'asc' } },
    });
    return rows.map((r) => r.semester);
  }
}
