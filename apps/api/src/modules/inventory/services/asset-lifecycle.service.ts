import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AssetLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  list(tenantId: string, inventoryItemId?: string) {
    return this.db().inventoryAssetService.findMany({
      where: {
        tenantId,
        ...(inventoryItemId ? { inventoryItemId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    user: JwtUser,
    dto: {
      inventoryItemId?: string;
      assetTag?: string;
      serviceType?: string;
      vendorName?: string;
      serviceDate?: string;
      warrantyUntil?: string;
      amcUntil?: string;
      cost?: number;
      notes?: string;
    },
  ) {
    return this.db().inventoryAssetService.create({
      data: {
        tenantId: user.tid,
        inventoryItemId: dto.inventoryItemId,
        assetTag: dto.assetTag,
        serviceType: dto.serviceType ?? 'AMC',
        vendorName: dto.vendorName,
        serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : null,
        warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null,
        amcUntil: dto.amcUntil ? new Date(dto.amcUntil) : null,
        cost: dto.cost,
        notes: dto.notes,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{
      inventoryItemId: string;
      assetTag: string;
      serviceType: string;
      vendorName: string;
      serviceDate: string;
      warrantyUntil: string;
      amcUntil: string;
      cost: number;
      notes: string;
    }>,
  ) {
    const row = await this.db().inventoryAssetService.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Asset service record not found');
    return this.db().inventoryAssetService.update({
      where: { id },
      data: {
        inventoryItemId: dto.inventoryItemId,
        assetTag: dto.assetTag,
        serviceType: dto.serviceType,
        vendorName: dto.vendorName,
        serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : undefined,
        warrantyUntil: dto.warrantyUntil
          ? new Date(dto.warrantyUntil)
          : undefined,
        amcUntil: dto.amcUntil ? new Date(dto.amcUntil) : undefined,
        cost: dto.cost,
        notes: dto.notes,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const row = await this.db().inventoryAssetService.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Asset service record not found');
    await this.db().inventoryAssetService.delete({ where: { id } });
    return { deleted: true };
  }
}
