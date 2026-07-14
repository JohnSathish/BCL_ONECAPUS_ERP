import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class InternshipService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  listCompanies(tenantId: string) {
    return this.db().internshipCompany.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  createCompany(
    user: JwtUser,
    dto: {
      name: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
    },
  ) {
    return this.db().internshipCompany.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        address: dto.address,
      },
    });
  }

  listPlacements(tenantId: string, companyId?: string) {
    return this.db().internshipPlacement.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
      },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createPlacement(
    user: JwtUser,
    dto: {
      companyId: string;
      studentId: string;
      mentorStaffId?: string;
      title: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ) {
    return this.db().internshipPlacement.create({
      data: {
        tenantId: user.tid,
        companyId: dto.companyId,
        studentId: dto.studentId,
        mentorStaffId: dto.mentorStaffId,
        title: dto.title.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status ?? 'ONGOING',
      },
    });
  }

  async updatePlacement(
    tenantId: string,
    id: string,
    dto: {
      status?: string;
      evaluationScore?: number;
      evaluationNotes?: string;
      endDate?: string;
    },
  ) {
    const row = await this.db().internshipPlacement.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Internship placement not found');
    return this.db().internshipPlacement.update({
      where: { id },
      data: {
        status: dto.status,
        evaluationScore: dto.evaluationScore,
        evaluationNotes: dto.evaluationNotes,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }
}
