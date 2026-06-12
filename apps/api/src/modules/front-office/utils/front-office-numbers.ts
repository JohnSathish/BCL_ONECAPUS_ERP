import { PrismaService } from '../../../database/prisma.service';

export async function nextFrontOfficeNumber(
  prisma: PrismaService,
  tenantId: string,
  prefix: 'FO-E' | 'FO-GP' | 'FO-C',
  table: 'enquiry' | 'gatePass' | 'complaint',
): Promise<string> {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  let count = 0;
  if (table === 'enquiry') {
    count = await prisma.frontOfficeEnquiry.count({
      where: { tenantId, enquiryNo: { startsWith: base } },
    });
  } else if (table === 'gatePass') {
    count = await prisma.frontOfficeGatePass.count({
      where: { tenantId, passNumber: { startsWith: base } },
    });
  } else {
    count = await prisma.frontOfficeComplaint.count({
      where: { tenantId, ticketNo: { startsWith: base } },
    });
  }

  return `${base}${String(count + 1).padStart(4, '0')}`;
}

export function generateGatePassCode() {
  return `GP${Math.floor(100000 + Math.random() * 900000)}`;
}

export function buildGatePassScanPayload(scanCode: string) {
  return `FO:GP:${scanCode}`;
}

export function gatePassQrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
}

export function normalizeGatePassScan(raw: string) {
  const trimmed = raw.trim().replace(/\r?\n$/, '');
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('FO:GP:')) {
    return {
      field: 'scanCode' as const,
      value: trimmed.slice(6).trim().toUpperCase(),
    };
  }
  if (upper.startsWith('FO:V:')) {
    return {
      field: 'passNumber' as const,
      value: trimmed.slice(5).trim().toUpperCase(),
    };
  }
  if (/^GP\d{6}$/i.test(trimmed)) {
    return { field: 'scanCode' as const, value: trimmed.toUpperCase() };
  }
  return { field: 'passNumber' as const, value: trimmed.toUpperCase() };
}
