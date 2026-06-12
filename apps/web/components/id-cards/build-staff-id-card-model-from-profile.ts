import { toBrandingDocumentContext } from '@/lib/branding-document';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { InstitutionBranding } from '@/types/branding';
import type { StaffIdCardModel } from '@/types/id-card';
import type { StaffProfile } from '@/types/staff';
import { isAcademicSessionText } from './id-card-programme-utils';

function safeAffiliationLine(branding?: InstitutionBranding | null): string | null {
  const sub = branding?.portalSubtitle?.trim();
  if (sub && !isAcademicSessionText(sub)) return sub;
  return 'Affiliated to North-Eastern Hill University (NEHU)';
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function formatCardDate(value: Date) {
  return value.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function staffRoleLabel(staffType: string | null | undefined) {
  switch (staffType) {
    case 'TEACHING':
      return 'TEACHING STAFF';
    case 'NON_TEACHING':
      return 'NON-TEACHING STAFF';
    case 'CONTRACT':
      return 'CONTRACT STAFF';
    case 'VISITING':
    case 'GUEST':
      return 'VISITING FACULTY';
    case 'ADMIN':
      return 'ADMIN STAFF';
    default:
      return 'STAFF';
  }
}

function qrImageUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

function emergencyContactFromProfile(profile: StaffProfile): string | null {
  const raw = profile.emergencyContactJson as { phone?: string; name?: string } | null | undefined;
  if (!raw?.phone && !raw?.name) return profile.mobile ?? null;
  if (raw.phone && raw.name) return `${raw.name} · ${raw.phone}`;
  return raw.phone ?? raw.name ?? null;
}

export function staffHolderTypeForGenerate(staffType: string | null | undefined): string {
  if (staffType === 'CONTRACT') return 'CONTRACT';
  if (staffType === 'VISITING' || staffType === 'GUEST') return 'VISITING';
  return 'STAFF';
}

export function buildStaffIdCardModelFromProfile(input: {
  profile: StaffProfile;
  branding?: InstitutionBranding | null;
  cardNumber?: string | null;
  validityYears?: number;
}): StaffIdCardModel {
  const { profile, branding, cardNumber, validityYears = 2 } = input;
  const doc = toBrandingDocumentContext(branding ?? undefined);

  const validFrom = new Date();
  const validTo = addYears(validFrom, validityYears);

  const shortName =
    branding?.shortName ??
    doc?.shortName ??
    (doc?.institutionName ?? 'Institution')
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 8)
      .toUpperCase();

  const qrPayload = cardNumber ?? profile.employeeCode;
  const employeeId = profile.employeeCode;

  return {
    cardType: 'staff',
    institution: {
      displayName: doc?.institutionName ?? branding?.displayName ?? 'Institution',
      shortName,
      logoUrl: doc?.logoUrl ?? resolveUploadAssetUrl(branding?.logoUrl) ?? null,
      address: doc?.address ?? branding?.address ?? null,
      campusName: doc?.campusName ?? branding?.campusName ?? null,
      primaryColor: doc?.primaryColor ?? '#001B44',
      accentColor: doc?.accentColor ?? '#C5A028',
      affiliationLine: safeAffiliationLine(branding),
      accreditationLine: 'Recognized by UGC · NAAC Accredited',
      phone: '+91 98622 12345',
      email: 'office@dbctura.ac.in',
      website: 'www.dbctura.ac.in',
    },
    holder: {
      fullName: profile.fullName,
      photoUrl: profile.photoUrl ? (resolveUploadAssetUrl(profile.photoUrl) ?? null) : null,
      roleLabel: staffRoleLabel(profile.staffType),
      employeeId,
      designation: profile.designation ?? null,
      department: profile.department ?? null,
      bloodGroup: profile.bloodGroup ?? null,
      rfidNumber: profile.rfidNo ?? null,
      emergencyContact: emergencyContactFromProfile(profile),
      email: profile.email ?? null,
      phone: profile.mobile ?? null,
      joiningDate: profile.joiningDate ?? null,
    },
    verification: {
      qrImageUrl: qrImageUrl(qrPayload),
      qrPayload,
      barcodeValue: employeeId.replace(/\s+/g, ''),
    },
    validity: {
      validFrom: formatCardDate(validFrom),
      validTo: formatCardDate(validTo),
      validToLabel: `VALID UP TO DEC ${validTo.getFullYear()}`,
    },
    branding,
  };
}
