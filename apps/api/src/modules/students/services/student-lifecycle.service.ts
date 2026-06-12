import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type LifecycleEventType =
  | 'READMISSION'
  | 'LEAVING'
  | 'DROPOUT'
  | 'ALUMNI'
  | 'MIGRATION'
  | 'DEACTIVATE';

@Injectable()
export class StudentLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(tenantId: string, studentId?: string, limit = 100) {
    return this.prisma.studentLifecycleEvent.findMany({
      where: {
        tenantId,
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: {
          select: {
            enrollmentNumber: true,
            masterProfile: { select: { fullName: true } },
          },
        },
        actor: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createEvent(
    tenantId: string,
    studentId: string,
    actorId: string,
    payload: {
      eventType: LifecycleEventType;
      effectiveDate: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const event = await this.prisma.studentLifecycleEvent.create({
      data: {
        tenantId,
        studentId,
        actorId,
        eventType: payload.eventType,
        effectiveDate: new Date(payload.effectiveDate),
        reason: payload.reason,
        metadata: (payload.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    if (payload.eventType === 'ALUMNI') {
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: { studentStatus: 'ALUMNI' },
      });
      await this.prisma.studentAcademicStanding.updateMany({
        where: { studentId },
        data: { programmeStatus: 'COMPLETED', alumniEligible: true },
      });
    } else if (payload.eventType === 'DEACTIVATE') {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: { isActive: false },
      });
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: { studentStatus: 'DROPPED', admissionStatus: 'INACTIVE' },
      });
    } else if (payload.eventType === 'LEAVING') {
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: { studentStatus: 'LEAVING' },
      });
    } else if (payload.eventType === 'READMISSION') {
      await this.prisma.studentProfile.update({
        where: { studentId },
        data: { studentStatus: 'STUDYING', admissionStatus: 'ACTIVE' },
      });
      await this.prisma.user.update({
        where: { id: student.userId },
        data: { isActive: true },
      });
    }

    return event;
  }

  async listRemarks(tenantId: string, studentId: string) {
    return this.prisma.studentRemark.findMany({
      where: { tenantId, studentId },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRemark(
    tenantId: string,
    studentId: string,
    actorId: string,
    payload: { remarkType: string; body: string; visibility?: string },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!payload.body.trim())
      throw new BadRequestException('Remark body is required');

    return this.prisma.studentRemark.create({
      data: {
        tenantId,
        studentId,
        actorId,
        remarkType: payload.remarkType,
        body: payload.body.trim(),
        visibility: payload.visibility ?? 'INTERNAL',
      },
    });
  }

  async listAuditLogs(tenantId: string, studentId?: string, limit = 200) {
    return this.prisma.studentProfileAuditLog.findMany({
      where: {
        tenantId,
        ...(studentId ? { studentId } : {}),
      },
      include: {
        actor: { select: { email: true } },
        student: {
          select: {
            enrollmentNumber: true,
            masterProfile: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
