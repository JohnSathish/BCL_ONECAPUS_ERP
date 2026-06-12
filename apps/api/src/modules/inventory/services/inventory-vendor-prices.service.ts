import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { UpsertVendorPriceDto } from '../dto/inventory.dto';

@Injectable()
export class InventoryVendorPricesService {
  constructor(private readonly prisma: PrismaService) {}

  listForVendor(tenantId: string, vendorId: string) {
    return this.prisma.inventoryVendorPrice.findMany({
      where: { tenantId, vendorId, status: 'ACTIVE' },
      include: {
        item: { select: { id: true, sku: true, name: true, unit: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  listForItem(tenantId: string, itemId: string) {
    return this.prisma.inventoryVendorPrice.findMany({
      where: { tenantId, itemId, status: 'ACTIVE' },
      include: { vendor: { select: { id: true, code: true, name: true } } },
      orderBy: { unitPrice: 'asc' },
    });
  }

  async upsert(user: JwtUser, vendorId: string, dto: UpsertVendorPriceDto) {
    const vendor = await this.prisma.inventoryVendor.findFirst({
      where: { tenantId: user.tid, id: vendorId, status: 'ACTIVE' },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const item = await this.prisma.inventoryItem.findFirst({
      where: { tenantId: user.tid, id: dto.itemId, status: 'ACTIVE' },
    });
    if (!item) throw new NotFoundException('Item not found');

    const existing = await this.prisma.inventoryVendorPrice.findFirst({
      where: { tenantId: user.tid, vendorId, itemId: dto.itemId },
    });

    if (existing) {
      return this.prisma.inventoryVendorPrice.update({
        where: { id: existing.id },
        data: {
          unitPrice: new Prisma.Decimal(dto.unitPrice),
          minOrderQty: dto.minOrderQty ?? existing.minOrderQty,
          leadDays: dto.leadDays,
          status: 'ACTIVE',
        },
        include: { item: true, vendor: true },
      });
    }

    return this.prisma.inventoryVendorPrice.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        vendorId,
        itemId: dto.itemId,
        unitPrice: new Prisma.Decimal(dto.unitPrice),
        minOrderQty: dto.minOrderQty ?? 1,
        leadDays: dto.leadDays,
      },
      include: { item: true, vendor: true },
    });
  }
}
