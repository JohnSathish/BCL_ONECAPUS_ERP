import type { StaffIdCardModel } from '@/types/id-card';
import type { IdCardIssue, IdCardSettings } from '@/services/id-cards';

function formatRfidDisplay(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (/^RFID[-:]/i.test(v)) return v.replace(/^RFID:/i, 'RFID-');
  return `RFID-${v.replace(/^0+/, '') || v}`;
}

function qrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

export function enhanceStaffCardModel(
  model: StaffIdCardModel,
  opts?: {
    activeIssue?: IdCardIssue | null;
    settings?: IdCardSettings | null;
  },
): StaffIdCardModel {
  const issue = opts?.activeIssue;
  const employeeId = model.holder.employeeId;
  const barcodeValue = (employeeId ?? issue?.cardNumber ?? model.verification.barcodeValue).replace(
    /\s+/g,
    '',
  );
  const qrPayload = issue?.qrPayload ?? model.verification.qrPayload;
  const rfidRaw = model.holder.rfidNumber ?? issue?.rfidUid ?? null;
  const rfidNumber = opts?.settings?.showRfidOnCard === false ? null : formatRfidDisplay(rfidRaw);

  return {
    ...model,
    institution: {
      ...model.institution,
      phone: model.institution.phone ?? '+91 98622 12345',
      email: model.institution.email ?? 'office@dbctura.ac.in',
      website: model.institution.website ?? 'www.dbctura.ac.in',
    },
    holder: {
      ...model.holder,
      rfidNumber,
    },
    verification: {
      qrImageUrl: qrPayload ? qrImageUrl(qrPayload) : model.verification.qrImageUrl,
      qrPayload,
      barcodeValue,
    },
  };
}
