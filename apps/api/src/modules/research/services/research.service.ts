import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string, status?: string) {
    return this.db().researchGrant.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    user: JwtUser,
    dto: {
      title: string;
      principalInvestigatorId?: string;
      fundingAgency?: string;
      amount?: number;
      startDate?: string;
      endDate?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.db().researchGrant.create({
      data: {
        tenantId: user.tid,
        title: dto.title.trim(),
        principalInvestigatorId: dto.principalInvestigatorId,
        fundingAgency: dto.fundingAgency,
        amount: dto.amount,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata ?? {},
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{
      title: string;
      principalInvestigatorId: string;
      fundingAgency: string;
      amount: number;
      startDate: string;
      endDate: string;
      status: string;
      metadata: Record<string, unknown>;
    }>,
  ) {
    const row = await this.db().researchGrant.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Research grant not found');
    return this.db().researchGrant.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        principalInvestigatorId: dto.principalInvestigatorId,
        fundingAgency: dto.fundingAgency,
        amount: dto.amount,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
        metadata: dto.metadata,
      },
    });
  }
}
