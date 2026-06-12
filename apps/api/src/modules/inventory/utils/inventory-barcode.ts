import { PrismaService } from '../../../database/prisma.service';

export async function nextInventoryPoNumber(
  prisma: PrismaService,
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const base = `PO-${year}-`;
  const count = await prisma.inventoryPurchaseOrder.count({
    where: { tenantId, poNumber: { startsWith: base } },
  });
  return `${base}${String(count + 1).padStart(4, '0')}`;
}

export async function nextInventoryRequisitionNumber(
  prisma: PrismaService,
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const base = `REQ-${year}-`;
  const count = await prisma.inventoryRequisition.count({
    where: { tenantId, requisitionNo: { startsWith: base } },
  });
  return `${base}${String(count + 1).padStart(4, '0')}`;
}

export function normalizeInventoryScanCode(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith('INV:')) {
    return trimmed.slice(4).trim();
  }
  return trimmed;
}

export function buildInventoryBarcode(sku: string) {
  const normalized = sku
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 16);
  return `INV-${normalized || 'ITEM'}`;
}

export function buildInventoryScanPayload(barcode: string) {
  return `INV:${barcode}`;
}

export function inventoryBarcodeImageUrl(barcode: string) {
  return `https://bwip-js-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcode)}&scale=2&height=8&includetext`;
}

export function inventoryQrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(payload)}`;
}
