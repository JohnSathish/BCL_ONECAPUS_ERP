import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateAppraisalCycleDto,
  ScoreAppraisalDto,
} from '../dto/appraisal.dto';

@Injectable()
export class AppraisalService {
  constructor(private readonly prisma: PrismaService) {}

  listCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      orderBy: { year: 'desc' },
      include: { _count: { select: { appraisals: true } } },
    });
  }

  createCycle(user: JwtUser, dto: CreateAppraisalCycleDto) {
    return this.prisma.appraisalCycle.create({
      data: {
        tenantId: user.tid,
        name: dto.name,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        templateJson: dto.templateJson as object | undefined,
        status: dto.status ?? 'DRAFT',
      },
    });
  }

  async launchCycle(user: JwtUser, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId: user.tid },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const staff = await this.prisma.staffProfile.findMany({
      where: { tenantId: user.tid, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    for (const s of staff) {
      await this.prisma.staffAppraisal.upsert({
        where: {
          tenantId_cycleId_staffProfileId: {
            tenantId: user.tid,
            cycleId,
            staffProfileId: s.id,
          },
        },
        create: {
          tenantId: user.tid,
          cycleId,
          staffProfileId: s.id,
          status: 'DRAFT',
        },
        update: {},
      });
    }

    return this.prisma.appraisalCycle.update({
      where: { id: cycleId },
      data: { status: 'ACTIVE' },
    });
  }

  listAppraisals(tenantId: string, cycleId?: string, staffProfileId?: string) {
    return this.prisma.staffAppraisal.findMany({
      where: {
        tenantId,
        ...(cycleId ? { cycleId } : {}),
        ...(staffProfileId ? { staffProfileId } : {}),
      },
      include: {
        cycle: { select: { name: true, year: true } },
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
            designation: { select: { label: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async buildKpiSnapshot(tenantId: string, staffProfileId: string) {
    const year = new Date().getFullYear();
    const monthStart = new Date(year, new Date().getMonth(), 1);

    const [publications, awards, assignments, attendance, payslip] =
      await Promise.all([
        this.prisma.staffPublication.count({ where: { staffProfileId } }),
        this.prisma.staffAward.count({ where: { staffProfileId } }),
        this.prisma.staffSubjectAssignment.count({ where: { staffProfileId } }),
        this.prisma.staffAttendanceDailyRecord.count({
          where: {
            tenantId,
            staffProfileId,
            attendanceDate: { gte: monthStart },
            status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] },
          },
        }),
        this.prisma.payslip.findFirst({
          where: { tenantId, staffProfileId, status: 'PUBLISHED' },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        }),
      ]);

    return {
      publications,
      awards,
      subjectAssignments: assignments,
      attendanceDaysThisMonth: attendance,
      latestNetSalary: payslip ? Number(payslip.netSalary) : null,
      capturedAt: new Date().toISOString(),
    };
  }

  async score(user: JwtUser, id: string, dto: ScoreAppraisalDto) {
    const appraisal = await this.prisma.staffAppraisal.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!appraisal) throw new NotFoundException('Appraisal not found');

    const kpiSnapshot =
      dto.role === 'SELF'
        ? await this.buildKpiSnapshot(user.tid, appraisal.staffProfileId)
        : undefined;

    const patch: Record<string, unknown> = { remarks: dto.remarks };
    if (dto.role === 'SELF') {
      patch.selfScore = dto.score;
      patch.status = 'SELF_SUBMITTED';
      patch.submittedAt = new Date();
      if (kpiSnapshot) patch.kpiSnapshot = kpiSnapshot;
    } else if (dto.role === 'HOD') {
      patch.hodScore = dto.score;
      patch.status = 'HOD_REVIEWED';
    } else if (dto.role === 'PRINCIPAL') {
      patch.principalScore = dto.score;
      patch.finalScore = dto.score;
      patch.status = 'FINALIZED';
      patch.finalizedAt = new Date();
    } else {
      throw new BadRequestException('Invalid scoring role');
    }

    return this.prisma.staffAppraisal.update({
      where: { id },
      data: patch,
      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },
        cycle: { select: { name: true, year: true } },
      },
    });
  }
}
