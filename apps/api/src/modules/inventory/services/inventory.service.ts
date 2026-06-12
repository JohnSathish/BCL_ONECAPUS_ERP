import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateItemDto,
  CreateStoreDto,
  ListQueryDto,
  StockMovementDto,
  UpdateItemDto,
} from '../dto/inventory.dto';
import {
  buildInventoryBarcode,
  normalizeInventoryScanCode,
} from '../utils/inventory-barcode';

type MovementType = 'RECEIPT' | 'ISSUE' | 'RETURN';

@Injectable()
export class InventoryStoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListQueryDto) {
    return this.prisma.inventoryStore.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        _count: { select: { items: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { code: 'asc' },
      take: query.limit ?? 50,
    });
  }

  async create(user: JwtUser, dto: CreateStoreDto) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.inventoryStore.findFirst({
      where: { tenantId: user.tid, code },
    });
    if (exists) throw new BadRequestException('Store code already exists');

    return this.prisma.inventoryStore.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        code,
        name: dto.name.trim(),
        location: dto.location?.trim(),
      },
    });
  }
}

@Injectable()
export class InventoryItemsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListQueryDto) {
    const q = query.q?.trim();
    return this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(q
          ? {
              OR: [
                { sku: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { barcode: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { store: { select: { id: true, code: true, name: true } } },
      orderBy: { sku: 'asc' },
      take: query.limit ?? 100,
    });
  }

  async create(user: JwtUser, dto: CreateItemDto) {
    const store = await this.prisma.inventoryStore.findFirst({
      where: { tenantId: user.tid, id: dto.storeId, status: 'ACTIVE' },
    });
    if (!store) throw new NotFoundException('Store not found');

    const sku = dto.sku.trim().toUpperCase();
    const exists = await this.prisma.inventoryItem.findFirst({
      where: { tenantId: user.tid, sku },
    });
    if (exists) throw new BadRequestException('SKU already exists');

    let barcode = (
      dto.barcode?.trim() || buildInventoryBarcode(sku)
    ).toUpperCase();
    const barcodeExists = await this.prisma.inventoryItem.findFirst({
      where: { tenantId: user.tid, barcode },
    });
    if (barcodeExists) {
      barcode = `${barcode}-${String(Date.now()).slice(-4)}`;
    }

    const qty = dto.quantityOnHand ?? 0;
    const item = await this.prisma.inventoryItem.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        storeId: dto.storeId,
        sku,
        barcode,
        name: dto.name.trim(),
        category: dto.category?.trim(),
        unit: dto.unit?.trim() || 'PCS',
        quantityOnHand: qty,
        reorderLevel: dto.reorderLevel ?? 0,
      },
      include: { store: true },
    });

    if (qty > 0) {
      await this.prisma.inventoryTransaction.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          storeId: dto.storeId,
          itemId: item.id,
          transactionType: 'RECEIPT',
          quantity: qty,
          balanceAfter: qty,
          notes: 'Opening stock',
          performedById: user.sub,
        },
      });
    }

    return item;
  }

  async update(user: JwtUser, id: string, dto: UpdateItemDto) {
    const row = await this.prisma.inventoryItem.findFirst({
      where: { tenantId: user.tid, id },
    });
    if (!row) throw new NotFoundException('Item not found');

    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        category: dto.category?.trim(),
        unit: dto.unit?.trim(),
        reorderLevel: dto.reorderLevel,
        status: dto.status,
      },
      include: { store: true },
    });
  }
}

@Injectable()
export class InventoryTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListQueryDto) {
    return this.prisma.inventoryTransaction.findMany({
      where: {
        tenantId,
        ...(query.storeId ? { storeId: query.storeId } : {}),
        ...(query.transactionType
          ? { transactionType: query.transactionType }
          : {}),
      },
      include: {
        item: { select: { sku: true, name: true, unit: true } },
        store: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
    });
  }

  private async resolveItemId(tenantId: string, dto: StockMovementDto) {
    if (dto.itemId) return dto.itemId;
    if (!dto.barcode?.trim()) {
      throw new BadRequestException('itemId or barcode is required');
    }
    const code = normalizeInventoryScanCode(dto.barcode);
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [{ barcode: code }, { sku: code.toUpperCase() }],
      },
    });
    if (!item) throw new NotFoundException('Item not found for barcode');
    return item.id;
  }

  receipt(user: JwtUser, dto: StockMovementDto) {
    return this.applyMovement(user, dto, 'RECEIPT', dto.quantity);
  }

  issue(user: JwtUser, dto: StockMovementDto) {
    return this.applyMovement(user, dto, 'ISSUE', -dto.quantity);
  }

  returnStock(user: JwtUser, dto: StockMovementDto) {
    return this.applyMovement(user, dto, 'RETURN', dto.quantity);
  }

  private async applyMovement(
    user: JwtUser,
    dto: StockMovementDto,
    type: MovementType,
    delta: number,
  ) {
    const itemId = await this.resolveItemId(user.tid, dto);
    const item = await this.prisma.inventoryItem.findFirst({
      where: { tenantId: user.tid, id: itemId, status: 'ACTIVE' },
    });
    if (!item) throw new NotFoundException('Item not found');

    if (type === 'ISSUE' && item.quantityOnHand + delta < 0) {
      throw new BadRequestException(
        `Insufficient stock for ${item.sku} (on hand: ${item.quantityOnHand})`,
      );
    }
    if (
      type === 'ISSUE' &&
      !dto.department?.trim() &&
      !dto.issuedToName?.trim()
    ) {
      throw new BadRequestException(
        'Department or recipient name required for issue',
      );
    }

    const balanceAfter = item.quantityOnHand + delta;

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantityOnHand: balanceAfter },
      });

      return tx.inventoryTransaction.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          storeId: item.storeId,
          itemId: item.id,
          transactionType: type,
          quantity: Math.abs(dto.quantity),
          balanceAfter,
          department: dto.department?.trim(),
          issuedToName: dto.issuedToName?.trim(),
          issuedToStaffId: dto.issuedToStaffId,
          notes: dto.notes?.trim(),
          performedById: user.sub,
        },
        include: {
          item: { select: { sku: true, name: true } },
          store: { select: { code: true, name: true } },
        },
      });
    });
  }
}

@Injectable()
export class InventoryDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const [
      activeStores,
      activeItems,
      recentIssues,
      totalStockValue,
      activeVendors,
      openPurchaseOrders,
      pendingRequisitions,
      restockSuggestions,
    ] = await Promise.all([
      this.prisma.inventoryStore.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.inventoryItem.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.inventoryTransaction.count({
        where: {
          tenantId,
          transactionType: 'ISSUE',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.inventoryItem.aggregate({
        where: { tenantId, status: 'ACTIVE' },
        _sum: { quantityOnHand: true },
      }),
      this.prisma.inventoryVendor.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.inventoryPurchaseOrder.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'PARTIAL'] } },
      }),
      this.prisma.inventoryRequisition.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM core.inventory_items
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'ACTIVE'
          AND reorder_level > 0
          AND quantity_on_hand <= reorder_level
      `,
    ]);

    const lowStockItems = await this.prisma.$queryRaw<
      {
        id: string;
        sku: string;
        name: string;
        quantity_on_hand: number;
        reorder_level: number;
      }[]
    >`
      SELECT id, sku, name, quantity_on_hand, reorder_level
      FROM core.inventory_items
      WHERE tenant_id = ${tenantId}::uuid
        AND status = 'ACTIVE'
        AND reorder_level > 0
        AND quantity_on_hand <= reorder_level
      ORDER BY quantity_on_hand ASC
      LIMIT 10
    `;

    const categoryBreakdown = await this.prisma.inventoryItem.groupBy({
      by: ['category'],
      where: { tenantId, status: 'ACTIVE' },
      _count: { id: true },
      _sum: { quantityOnHand: true },
    });

    return {
      activeStores,
      activeItems,
      activeVendors,
      openPurchaseOrders,
      pendingRequisitions,
      restockSuggestionCount: Number(restockSuggestions[0]?.count ?? 0),
      lowStockCount: lowStockItems.length,
      issuesLast7Days: recentIssues,
      totalUnitsOnHand: totalStockValue._sum.quantityOnHand ?? 0,
      lowStockItems: lowStockItems.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        quantityOnHand: i.quantity_on_hand,
        reorderLevel: i.reorder_level,
      })),
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category ?? 'Uncategorized',
        itemCount: c._count.id,
        totalUnits: c._sum.quantityOnHand ?? 0,
      })),
    };
  }
}
