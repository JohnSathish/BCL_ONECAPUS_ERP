import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ScholarshipSchemeService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string) {
    return this.db().scholarshipScheme.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    user: JwtUser,
    dto: {
      code: string;
      name: string;
      schemeType: string;
      calculationType: string;
      value: number;
      description?: string;
    },
  ) {
    const existing = await this.db().scholarshipScheme.findFirst({
      where: { tenantId: user.tid, code: dto.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Scheme code already exists');
    return this.db().scholarshipScheme.create({
      data: {
        tenantId: user.tid,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        schemeType: dto.schemeType,
        calculationType: dto.calculationType,
        value: dto.value,
        description: dto.description,
        isActive: true,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: Record<string, unknown>) {
    await this.ensure(user.tid, id);
    return this.db().scholarshipScheme.update({
      where: { id },
      data: {
        ...(dto.name ? { name: String(dto.name) } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  private async ensure(tenantId: string, id: string) {
    const row = await this.db().scholarshipScheme.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Scholarship scheme not found');
    return row;
  }
}
