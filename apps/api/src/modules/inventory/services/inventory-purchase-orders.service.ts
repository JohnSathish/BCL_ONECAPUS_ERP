import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreatePurchaseOrderDto,
  ListQueryDto,
  ReceivePoLineDto,
} from '../dto/inventory.dto';
import { nextInventoryPoNumber } from '../utils/inventory-barcode';

@Injectable()
export class InventoryPurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: ListQueryDto) {
    return this.prisma.inventoryPurchaseOrder.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
      },
      include: {
        vendor: { select: { code: true, name: true } },
        store: { select: { code: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { orderDate: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.inventoryPurchaseOrder.findFirst({
      where: { tenantId, id },
      include: {
        vendor: true,
        store: true,
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, barcode: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Purchase order not found');
    return row;
  }

  async create(user: JwtUser, dto: CreatePurchaseOrderDto) {
    if (!dto.lines?.length)
      throw new BadRequestException('At least one line is required');

    const vendor = await this.prisma.inventoryVendor.findFirst({
      where: { tenantId: user.tid, id: dto.vendorId, status: 'ACTIVE' },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    if (dto.storeId) {
      const store = await this.prisma.inventoryStore.findFirst({
        where: { tenantId: user.tid, id: dto.storeId, status: 'ACTIVE' },
      });
      if (!store) throw new NotFoundException('Store not found');
    }

    const poNumber = await nextInventoryPoNumber(this.prisma, user.tid);
    let totalAmount = new Prisma.Decimal(0);

    const linesData = await Promise.all(
      dto.lines.map(async (line) => {
        if (line.itemId) {
          const item = await this.prisma.inventoryItem.findFirst({
            where: { tenantId: user.tid, id: line.itemId, status: 'ACTIVE' },
          });
          if (!item)
            throw new NotFoundException(`Item ${line.itemId} not found`);
        }
        const unitPrice =
          line.unitPrice != null ? new Prisma.Decimal(line.unitPrice) : null;
        if (unitPrice) {
          totalAmount = totalAmount.add(unitPrice.mul(line.quantityOrdered));
        }
        return {
          id: randomUUID(),
          tenantId: user.tid,
          itemId: line.itemId,
          description: line.description.trim(),
          sku: line.sku?.trim(),
          quantityOrdered: line.quantityOrdered,
          unitPrice,
        };
      }),
    );

    return this.prisma.inventoryPurchaseOrder.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        poNumber,
        vendorId: dto.vendorId,
        storeId: dto.storeId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        notes: dto.notes?.trim(),
        totalAmount: totalAmount.gt(0) ? totalAmount : undefined,
        createdById: user.sub,
        lines: { create: linesData },
      },
      include: {
        vendor: true,
        lines: { include: { item: true } },
      },
    });
  }

  async submit(user: JwtUser, id: string) {
    const po = await this.get(user.tid, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only draft POs can be submitted');

    return this.prisma.inventoryPurchaseOrder.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: { vendor: true, lines: true },
    });
  }

  async cancel(user: JwtUser, id: string) {
    const po = await this.get(user.tid, id);
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new BadRequestException('PO cannot be cancelled');
    }

    return this.prisma.inventoryPurchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async receiveLine(user: JwtUser, poId: string, dto: ReceivePoLineDto) {
    const po = await this.get(user.tid, poId);
    if (!['SUBMITTED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException('PO must be submitted before receiving');
    }

    const line = po.lines.find((l) => l.id === dto.lineId);
    if (!line) throw new NotFoundException('PO line not found');

    const remaining = line.quantityOrdered - line.quantityReceived;
    if (dto.quantity > remaining) {
      throw new BadRequestException(
        `Cannot receive ${dto.quantity}; only ${remaining} remaining`,
      );
    }

    let itemId = line.itemId;
    if (!itemId && line.sku) {
      const item = await this.prisma.inventoryItem.findFirst({
        where: {
          tenantId: user.tid,
          sku: line.sku.trim().toUpperCase(),
          status: 'ACTIVE',
        },
      });
      itemId = item?.id ?? null;
    }
    if (!itemId)
      throw new BadRequestException(
        'Line must be linked to an inventory item to receive stock',
      );

    const item = await this.prisma.inventoryItem.findFirst({
      where: { tenantId: user.tid, id: itemId, status: 'ACTIVE' },
    });
    if (!item) throw new NotFoundException('Item not found');

    const balanceAfter = item.quantityOnHand + dto.quantity;

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantityOnHand: balanceAfter },
      });

      await tx.inventoryTransaction.create({
        data: {
          id: randomUUID(),
          tenantId: user.tid,
          storeId: item.storeId,
          itemId: item.id,
          purchaseOrderId: po.id,
          transactionType: 'RECEIPT',
          quantity: dto.quantity,
          balanceAfter,
          notes: `PO ${po.poNumber}`,
          performedById: user.sub,
        },
      });

      await tx.inventoryPurchaseOrderLine.update({
        where: { id: line.id },
        data: {
          quantityReceived: line.quantityReceived + dto.quantity,
          itemId: item.id,
        },
      });

      const updatedLines = await tx.inventoryPurchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });
      const allReceived = updatedLines.every(
        (l) => l.quantityReceived >= l.quantityOrdered,
      );
      const anyReceived = updatedLines.some((l) => l.quantityReceived > 0);

      await tx.inventoryPurchaseOrder.update({
        where: { id: po.id },
        data: {
          status: allReceived
            ? 'RECEIVED'
            : anyReceived
              ? 'PARTIAL'
              : po.status,
        },
      });
    });

    return this.get(user.tid, poId);
  }
}
