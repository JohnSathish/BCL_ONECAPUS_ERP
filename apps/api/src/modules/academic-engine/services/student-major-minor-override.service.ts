import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateStudentMajorMinorOverrideDto } from '../dto/major-minor-override.dto';

type OverrideScope = {
  semesterSequence?: number;
  programVersionId?: string;
  shiftId?: string;
  academicYearId?: string;
};

@Injectable()
export class StudentMajorMinorOverrideService {
  constructor(private readonly prisma: PrismaService) {}

  async createOverride(
    tenantId: string,
    studentId: string,
    actorId: string,
    dto: CreateStudentMajorMinorOverrideDto,
  ) {
    if (
      dto.effectiveToSemester != null &&
      dto.effectiveFromSemester != null &&
      dto.effectiveToSemester < dto.effectiveFromSemester
    ) {
      throw new BadRequestException(
        'effectiveToSemester cannot be less than effectiveFromSemester',
      );
    }

    const [student, major, minor] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: studentId, tenantId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.academicSubject.findFirst({
        where: {
          id: dto.majorSubjectId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      }),
      this.prisma.academicSubject.findFirst({
        where: {
          id: dto.minorSubjectId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!major) throw new BadRequestException('Major subject not found');
    if (!minor) throw new BadRequestException('Minor subject not found');

    return (this.prisma as any).studentMajorMinorOverride.create({
      data: {
        tenantId,
        studentId,
        majorSubjectId: dto.majorSubjectId,
        minorSubjectId: dto.minorSubjectId,
        programVersionId: dto.programVersionId ?? null,
        shiftId: dto.shiftId ?? null,
        academicYearId: dto.academicYearId ?? null,
        effectiveFromSemester: dto.effectiveFromSemester ?? 1,
        effectiveToSemester: dto.effectiveToSemester ?? null,
        status: dto.status ?? 'APPROVED',
        reason: dto.reason.trim(),
        approvalAuthority: dto.approvalAuthority,
        approvedById: dto.status === 'DRAFT' ? null : actorId,
        approvedAt: dto.status === 'DRAFT' ? null : new Date(),
        supportingDocumentUrl: dto.supportingDocumentUrl?.trim() || null,
        approvalRef: dto.approvalRef?.trim() || null,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        createdById: actorId,
      },
    });
  }

  async listOverrides(tenantId: string, studentId: string, status?: string) {
    return (this.prisma as any).studentMajorMinorOverride.findMany({
      where: { tenantId, studentId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getActiveOverride(
    tenantId: string,
    studentId: string,
    scope: OverrideScope,
  ) {
    const rows = await (this.prisma as any).studentMajorMinorOverride.findMany({
      where: {
        tenantId,
        studentId,
        status: 'APPROVED',
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.find((row: any) => this.matchesScope(row, scope)) ?? null;
  }

  async revokeOverride(
    tenantId: string,
    studentId: string,
    overrideId: string,
    actorId: string,
    reason: string,
  ) {
    const existing = await (
      this.prisma as any
    ).studentMajorMinorOverride.findFirst({
      where: { id: overrideId, tenantId, studentId },
      select: { id: true, status: true, revokedAt: true },
    });
    if (!existing) throw new NotFoundException('Override not found');
    if (existing.revokedAt) return existing;
    return (this.prisma as any).studentMajorMinorOverride.update({
      where: { id: overrideId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: actorId,
        revokedReason: reason.trim(),
      },
    });
  }

  private matchesScope(
    row: {
      effectiveFromSemester: number;
      effectiveToSemester: number | null;
      programVersionId: string | null;
      shiftId: string | null;
      academicYearId: string | null;
    },
    scope: OverrideScope,
  ) {
    if (
      scope.semesterSequence != null &&
      scope.semesterSequence < row.effectiveFromSemester
    ) {
      return false;
    }
    if (
      scope.semesterSequence != null &&
      row.effectiveToSemester != null &&
      scope.semesterSequence > row.effectiveToSemester
    ) {
      return false;
    }
    if (
      row.programVersionId &&
      scope.programVersionId !== row.programVersionId
    ) {
      return false;
    }
    if (row.shiftId && scope.shiftId !== row.shiftId) return false;
    if (row.academicYearId && scope.academicYearId !== row.academicYearId) {
      return false;
    }
    return true;
  }
}
