import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MonthlyFeePlanService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string) {
    return this.db().monthlyFeePlan.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        modifiers: { where: { isActive: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  getOne(tenantId: string, id: string) {
    return this.ensure(tenantId, id);
  }

  async create(
    user: JwtUser,
    dto: {
      code: string;
      name: string;
      programId?: string;
      shiftId?: string;
      majorSlug?: string;
      streamCode?: string;
      lines?: Array<{
        code: string;
        name: string;
        amount: number;
        sortOrder?: number;
      }>;
    },
  ) {
    const existing = await this.db().monthlyFeePlan.findFirst({
      where: { tenantId: user.tid, code: dto.code, deletedAt: null },
    });
    if (existing)
      throw new ConflictException(`Plan code "${dto.code}" already exists`);

    return this.db().monthlyFeePlan.create({
      data: {
        tenantId: user.tid,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        programId: dto.programId,
        shiftId: dto.shiftId,
        majorSlug: dto.majorSlug?.toLowerCase(),
        streamCode: dto.streamCode,
        status: 'ACTIVE',
        ...(dto.lines?.length
          ? {
              lines: {
                create: dto.lines.map((line, i) => ({
                  tenantId: user.tid,
                  code: line.code,
                  name: line.name,
                  amount: line.amount,
                  sortOrder: line.sortOrder ?? (i + 1) * 10,
                })),
              },
            }
          : {}),
      },
      include: { lines: true, modifiers: true },
    });
  }

  async update(user: JwtUser, id: string, dto: Record<string, unknown>) {
    await this.ensure(user.tid, id);
    if (Array.isArray(dto.lines)) {
      await this.db().monthlyFeePlanLine.deleteMany({ where: { planId: id } });
      const lines = dto.lines as Array<{
        code: string;
        name: string;
        amount: number;
      }>;
      if (lines.length) {
        await this.db().monthlyFeePlanLine.createMany({
          data: lines.map((line, i) => ({
            tenantId: user.tid,
            planId: id,
            code: line.code,
            name: line.name,
            amount: line.amount,
            sortOrder: (i + 1) * 10,
          })),
        });
      }
    }
    return this.db().monthlyFeePlan.update({
      where: { id },
      data: {
        ...(dto.name ? { name: String(dto.name) } : {}),
        ...(dto.programId !== undefined
          ? { programId: dto.programId as string | null }
          : {}),
        ...(dto.shiftId !== undefined
          ? { shiftId: dto.shiftId as string | null }
          : {}),
        ...(dto.majorSlug !== undefined
          ? { majorSlug: dto.majorSlug as string | null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { lines: true, modifiers: true },
    });
  }

  private async ensure(tenantId: string, id: string) {
    const plan = await this.db().monthlyFeePlan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { lines: true, modifiers: true },
    });
    if (!plan) throw new NotFoundException('Monthly fee plan not found');
    return plan;
  }
}
