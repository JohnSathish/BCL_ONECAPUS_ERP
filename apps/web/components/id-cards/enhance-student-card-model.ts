import type { StudentIdCardModel } from '@/types/id-card';
import type { IdCardIssue, IdCardSettings } from '@/services/id-cards';
import { formatDisplayGender } from './id-card-pursuit-excellence';

function qrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

function formatRfidDisplay(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (/^RFID[-:]/i.test(v)) return v.replace(/^RFID:/i, 'RFID-');
  return `RFID-${v.replace(/^0+/, '') || v}`;
}

function defaultInstitutionContact(displayName: string) {
  const lower = displayName.toLowerCase();
  if (lower.includes('don bosco') && lower.includes('tura')) {
    return {
      phone: '+91 98622 12345',
      email: 'office@dbctura.ac.in',
      website: 'www.dbctura.ac.in',
    };
  }
  return {
    phone: null as string | null,
    email: null as string | null,
    website: null as string | null,
  };
}

/** Merge live profile data with issued card record + tenant settings for production preview/print. */
export function enhanceStudentCardModel(
  model: StudentIdCardModel,
  opts?: {
    activeIssue?: IdCardIssue | null;
    settings?: IdCardSettings | null;
  },
): StudentIdCardModel {
  const issue = opts?.activeIssue;
  const reg = model.holder.registrationNumber ?? model.holder.rollNumber;
  const barcodeValue = (reg ?? issue?.cardNumber ?? model.verification.barcodeValue).replace(
    /\s+/g,
    '',
  );
  const qrPayload = issue?.qrPayload ?? model.verification.qrPayload;
  const rfidRaw = model.holder.rfidNumber ?? issue?.rfidUid ?? null;
  const rfidNumber = opts?.settings?.showRfidOnCard === false ? null : formatRfidDisplay(rfidRaw);
  const contactDefaults = defaultInstitutionContact(model.institution.displayName);

  return {
    ...model,
    institution: {
      ...model.institution,
      phone: model.institution.phone ?? contactDefaults.phone,
      email: model.institution.email ?? contactDefaults.email,
      website: model.institution.website ?? contactDefaults.website,
    },
    holder: {
      ...model.holder,
      displayFullName: (model.holder.displayFullName ?? model.holder.fullName).toUpperCase(),
      gender: formatDisplayGender(model.holder.gender) || model.holder.gender,
      rfidNumber,
      programme: model.holder.programme ?? model.holder.subtitle ?? null,
    },
    verification: {
      qrImageUrl: qrPayload ? qrImageUrl(qrPayload) : model.verification.qrImageUrl,
      qrPayload,
      barcodeValue,
    },
  };
}
