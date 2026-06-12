import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { LabelBatchDto } from '../dto/inventory.dto';
import {
  buildInventoryScanPayload,
  inventoryBarcodeImageUrl,
  inventoryQrImageUrl,
  normalizeInventoryScanCode,
} from '../utils/inventory-barcode';

@Injectable()
export class InventoryLabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async lookupByBarcode(tenantId: string, barcode: string) {
    const code = normalizeInventoryScanCode(barcode);
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [{ barcode: code }, { sku: code.toUpperCase() }],
      },
      include: { store: { select: { code: true, name: true } } },
    });
    if (!item) throw new NotFoundException('Item not found for barcode');
    return item;
  }

  async batchLabels(tenantId: string, dto: LabelBatchDto) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(dto.itemIds?.length ? { id: { in: dto.itemIds } } : {}),
        ...(dto.storeId ? { storeId: dto.storeId } : {}),
      },
      include: { store: { select: { code: true } } },
      orderBy: { sku: 'asc' },
      take: dto.limit ?? 50,
    });

    return items.map((item) => {
      const payload = buildInventoryScanPayload(item.barcode);
      return {
        id: item.id,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        unit: item.unit,
        storeCode: item.store.code,
        scanPayload: payload,
        barcodeImageUrl: inventoryBarcodeImageUrl(item.barcode),
        qrImageUrl: inventoryQrImageUrl(payload),
      };
    });
  }
}
