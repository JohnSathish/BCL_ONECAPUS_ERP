import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ParentPortalService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async createLink(
    user: JwtUser,
    dto: {
      parentUserId: string;
      studentId: string;
      relationship?: string;
      isPrimary?: boolean;
    },
  ) {
    return this.db().parentStudentLink.create({
      data: {
        tenantId: user.tid,
        parentUserId: dto.parentUserId,
        studentId: dto.studentId,
        relationship: dto.relationship ?? 'GUARDIAN',
        isPrimary: dto.isPrimary ?? false,
        status: 'ACTIVE',
      },
    });
  }

  async listLinks(tenantId: string, parentUserId?: string) {
    return this.db().parentStudentLink.findMany({
      where: {
        tenantId,
        ...(parentUserId ? { parentUserId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteLink(tenantId: string, id: string) {
    const row = await this.db().parentStudentLink.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Parent–student link not found');
    await this.db().parentStudentLink.delete({ where: { id } });
    return { deleted: true };
  }

  async myWards(user: JwtUser) {
    const links = await this.db().parentStudentLink.findMany({
      where: {
        tenantId: user.tid,
        parentUserId: user.sub,
        status: 'ACTIVE',
      },
    });
    if (!links.length) return [];

    const studentIds = links.map((l: { studentId: string }) => l.studentId);
    const students = await this.db().student.findMany({
      where: {
        tenantId: user.tid,
        id: { in: studentIds },
        deletedAt: null,
      },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        admissionNumber: true,
        departmentId: true,
        programVersionId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    const byId = new Map(students.map((s: { id: string }) => [s.id, s]));
    return links.map(
      (link: {
        studentId: string;
        relationship: string;
        isPrimary: boolean;
      }) => ({
        ...link,
        student: byId.get(link.studentId) ?? null,
      }),
    );
  }

  async wardSummary(user: JwtUser, studentId: string) {
    const link = await this.db().parentStudentLink.findFirst({
      where: {
        tenantId: user.tid,
        parentUserId: user.sub,
        studentId,
        status: 'ACTIVE',
      },
    });
    if (!link) throw new NotFoundException('Ward not linked to this parent');

    const student = await this.db().student.findFirst({
      where: { id: studentId, tenantId: user.tid, deletedAt: null },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        admissionNumber: true,
        universityRollNumber: true,
        admissionDate: true,
        departmentId: true,
        programVersionId: true,
        primaryShiftId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
        masterProfile: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return { link, student };
  }
}
