import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { CreatePoFromSuggestionDto } from '../dto/inventory.dto';
import { nextInventoryPoNumber } from '../utils/inventory-barcode';

@Injectable()
export class InventorySuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async restockSuggestions(tenantId: string) {
    const lowStock = await this.prisma.$queryRaw<
      {
        id: string;
        sku: string;
        name: string;
        unit: string;
        quantity_on_hand: number;
        reorder_level: number;
        store_id: string;
      }[]
    >`
      SELECT id, sku, name, unit, quantity_on_hand, reorder_level, store_id
      FROM core.inventory_items
      WHERE tenant_id = ${tenantId}::uuid
        AND status = 'ACTIVE'
        AND reorder_level > 0
        AND quantity_on_hand <= reorder_level
      ORDER BY quantity_on_hand ASC
      LIMIT 50
    `;

    const suggestions = await Promise.all(
      lowStock.map(async (item) => {
        const suggestedOrderQty = Math.max(
          item.reorder_level * 2 - item.quantity_on_hand,
          item.reorder_level,
        );

        const prices = await this.prisma.inventoryVendorPrice.findMany({
          where: { tenantId, itemId: item.id, status: 'ACTIVE' },
          include: { vendor: { select: { id: true, code: true, name: true } } },
          orderBy: { unitPrice: 'asc' },
          take: 3,
        });

        const preferred = prices[0];

        return {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          quantityOnHand: item.quantity_on_hand,
          reorderLevel: item.reorder_level,
          storeId: item.store_id,
          suggestedOrderQty,
          preferredVendor: preferred
            ? {
                id: preferred.vendor.id,
                code: preferred.vendor.code,
                name: preferred.vendor.name,
                unitPrice: Number(preferred.unitPrice),
                minOrderQty: preferred.minOrderQty,
              }
            : null,
          vendorOptions: prices.map((p) => ({
            vendorId: p.vendor.id,
            vendorCode: p.vendor.code,
            vendorName: p.vendor.name,
            unitPrice: Number(p.unitPrice),
          })),
        };
      }),
    );

    return suggestions;
  }

  async createPoFromSuggestions(user: JwtUser, dto: CreatePoFromSuggestionDto) {
    if (!dto.itemIds?.length)
      throw new BadRequestException('Select at least one item');

    const vendor = await this.prisma.inventoryVendor.findFirst({
      where: { tenantId: user.tid, id: dto.vendorId, status: 'ACTIVE' },
    });
    if (!vendor) throw new BadRequestException('Vendor not found');

    const suggestions = await this.restockSuggestions(user.tid);
    const selected = suggestions.filter((s) => dto.itemIds.includes(s.itemId));
    if (!selected.length)
      throw new BadRequestException('No valid low-stock items selected');

    const poNumber = await nextInventoryPoNumber(this.prisma, user.tid);
    let totalAmount = new Prisma.Decimal(0);

    const linesData = await Promise.all(
      selected.map(async (s) => {
        const priceRow = await this.prisma.inventoryVendorPrice.findFirst({
          where: {
            tenantId: user.tid,
            vendorId: dto.vendorId,
            itemId: s.itemId,
            status: 'ACTIVE',
          },
        });
        const unitPrice = priceRow?.unitPrice ?? null;
        const qty = Math.max(s.suggestedOrderQty, priceRow?.minOrderQty ?? 1);
        if (unitPrice) totalAmount = totalAmount.add(unitPrice.mul(qty));

        return {
          id: randomUUID(),
          tenantId: user.tid,
          itemId: s.itemId,
          description: s.name,
          sku: s.sku,
          quantityOrdered: qty,
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
        storeId: dto.storeId ?? selected[0]?.storeId,
        notes: 'Auto-generated from low-stock suggestions',
        totalAmount: totalAmount.gt(0) ? totalAmount : undefined,
        createdById: user.sub,
        status: 'DRAFT',
        lines: { create: linesData },
      },
      include: { vendor: true, lines: { include: { item: true } } },
    });
  }
}
