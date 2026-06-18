import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 3600 * 1000)) + 1);
}

@Injectable()
export class StudentLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private include = {
    leaveType: { select: { id: true, code: true, name: true } },
    student: {
      include: {
        masterProfile: { select: { fullName: true, mobileNumber: true } },
        department: { select: { name: true } },
        academicStanding: { select: { currentSemesterSequence: true } },
      },
    },
  } as const;

  async listTypes(tenantId: string) {
    return this.prisma.studentLeaveType.findMany({
      where: { tenantId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async ensureDefaultTypes(tenantId: string) {
    const defaults = [
      { code: 'MEDICAL', name: 'Medical Leave' },
      { code: 'CASUAL', name: 'Casual Leave' },
      { code: 'DUTY', name: 'Duty Leave' },
    ];
    for (const row of defaults) {
      await this.prisma.studentLeaveType.upsert({
        where: { tenantId_code: { tenantId, code: row.code } },
        update: {},
        create: { tenantId, ...row },
      });
    }
  }

  async apply(
    user: JwtUser,
    dto: {
      leaveTypeId: string;
      fromDate: string;
      toDate: string;
      reason?: string;
      attachmentUrl?: string;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
    });
    if (!student) throw new BadRequestException('Student profile required');

    const leaveType = await this.prisma.studentLeaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId: user.tid, active: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    if (toDate < fromDate) {
      throw new BadRequestException('toDate must be on or after fromDate');
    }

    return this.prisma.studentLeaveApplication.create({
      data: {
        tenantId: user.tid,
        studentId: student.id,
        leaveTypeId: dto.leaveTypeId,
        fromDate,
        toDate,
        totalDays: daysBetween(fromDate, toDate),
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl,
        status: 'PENDING',
      },
      include: this.include,
    });
  }

  async listPending(tenantId: string) {
    await this.ensureDefaultTypes(tenantId);
    return this.prisma.studentLeaveApplication.findMany({
      where: { tenantId, status: 'PENDING' },
      include: this.include,
      orderBy: { fromDate: 'asc' },
    });
  }

  async listForStudent(tenantId: string, studentId: string) {
    return this.prisma.studentLeaveApplication.findMany({
      where: { tenantId, studentId },
      include: { leaveType: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(
    user: JwtUser,
    id: string,
    dto: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string },
  ) {
    const app = await this.prisma.studentLeaveApplication.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!app) throw new NotFoundException('Leave application not found');
    if (app.status !== 'PENDING') {
      throw new BadRequestException('Leave application already processed');
    }

    return this.prisma.studentLeaveApplication.update({
      where: { id },
      data: {
        status: dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedById: user.sub,
        reviewedAt: new Date(),
        rejectionReason:
          dto.action === 'REJECT' ? (dto.rejectionReason ?? 'Rejected') : null,
      },
      include: this.include,
    });
  }
}
