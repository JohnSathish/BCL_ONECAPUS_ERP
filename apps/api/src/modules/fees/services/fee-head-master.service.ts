import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateFeeHeadDto,
  FeeHeadQueryDto,
  ReorderFeeHeadsDto,
  UpdateFeeHeadDto,
} from '../dto/fee-cycle.dto';

@Injectable()
export class FeeHeadMasterService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async list(tenantId: string, query: FeeHeadQueryDto = {}) {
    const heads = await this.db().feeHeadMaster.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const totalAmount = heads.reduce(
      (sum: number, h: { amount: unknown }) => sum + Number(h.amount),
      0,
    );
    return { heads, totalAmount, count: heads.length };
  }

  async create(user: JwtUser, dto: CreateFeeHeadDto) {
    const existing = await this.db().feeHeadMaster.findFirst({
      where: { tenantId: user.tid, code: dto.code, deletedAt: null },
    });
    if (existing)
      throw new ConflictException(`Fee head code "${dto.code}" already exists`);

    const head = await this.db().feeHeadMaster.create({
      data: {
        tenantId: user.tid,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        amount: dto.amount,
        category: dto.category ?? 'SESSION',
        sortOrder: dto.sortOrder ?? 100,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(user, 'fee_head.created', head.id, { after: head });
    return head;
  }

  async update(user: JwtUser, id: string, dto: UpdateFeeHeadDto) {
    const before = await this.ensure(user.tid, id);
    const head = await this.db().feeHeadMaster.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit(user, 'fee_head.updated', id, { before, after: head });
    return head;
  }

  async remove(user: JwtUser, id: string) {
    const before = await this.ensure(user.tid, id);
    const inUse = await this.db().academicFeeCycleLine.count({
      where: { feeHeadId: id, tenantId: user.tid },
    });
    if (inUse > 0) {
      const head = await this.db().feeHeadMaster.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await this.audit(user, 'fee_head.deactivated', id, {
        before,
        after: head,
      });
      return head;
    }
    const head = await this.db().feeHeadMaster.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit(user, 'fee_head.deleted', id, { before, after: head });
    return head;
  }

  async reorder(user: JwtUser, dto: ReorderFeeHeadsDto) {
    await Promise.all(
      dto.orderedIds.map((id, index) =>
        this.db().feeHeadMaster.updateMany({
          where: { id, tenantId: user.tid, deletedAt: null },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ),
    );
    await this.audit(user, 'fee_head.reordered', null, {
      orderedIds: dto.orderedIds,
    });
    return this.list(user.tid);
  }

  private async ensure(tenantId: string, id: string) {
    const head = await this.db().feeHeadMaster.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!head) throw new NotFoundException('Fee head not found');
    return head;
  }

  private async audit(
    user: JwtUser,
    action: string,
    entityId: string | null,
    payload: Record<string, unknown>,
  ) {
    await this.db().feeAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        action,
        metadata: { entityType: 'fee_head', entityId, ...payload },
      },
    });
  }
}
