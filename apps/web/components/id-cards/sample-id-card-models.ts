import type { IdCardModel, StaffIdCardModel, StudentIdCardModel } from '@/types/id-card';
import type { InstitutionBranding } from '@/types/branding';
import { toBrandingDocumentContext } from '@/lib/branding-document';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';

export const SAMPLE_STUDENT_ID_CARD: StudentIdCardModel = {
  cardType: 'student',
  institution: {
    displayName: 'Don Bosco College, Tura',
    shortName: 'DBC Tura',
    logoUrl: null,
    address: 'Tura, West Garo Hills, Meghalaya - 794 002',
    campusName: null,
    primaryColor: '#001B44',
    accentColor: '#8B1538',
    affiliationLine: 'Affiliated to NEHU, Shillong',
    accreditationLine: 'NAAC Accredited',
  },
  holder: {
    fullName: 'Rikchakam Ch Marak',
    displayFullName: 'RIKCHAKAM CH MARAK',
    photoUrl: null,
    roleLabel: 'STUDENT',
    subtitle: 'B.A. (Economics)',
    rollNumber: 'APP-2026-0001',
    registrationNumber: 'REG2026048',
    department: 'Education',
    programme: 'B.A. (Economics)',
    semester: null,
    shift: 'Morning',
    gender: 'Male',
    fatherName: 'Bablu Ch Marak',
    motherName: 'Tina T Sangma',
    holderAddress: 'Daren Agal, West Garo Hills, Meghalaya',
    bloodGroup: 'O+',
    rfidNumber: 'RFID-00001234',
    emergencyContact: '+91 98765 43210',
  },
  verification: {
    qrImageUrl: null,
    qrPayload: 'DBC-STU-2026-0001',
    barcodeValue: 'REG2026048',
  },
  validity: {
    validFrom: '3 Jun 2026',
    validTo: '31 Dec 2029',
    validToLabel: 'VALID UP TO 2029',
    validUntil: 'Jun 2026',
    courseCompletion: 'Dec 2029',
    expiryDate: 'Dec 2029',
  },
};

export const SAMPLE_STAFF_ID_CARD: StaffIdCardModel = {
  cardType: 'staff',
  institution: {
    ...SAMPLE_STUDENT_ID_CARD.institution,
    primaryColor: '#001B44',
    accentColor: '#C5A028',
    affiliationLine: 'Affiliated to North-Eastern Hill University (NEHU)',
    accreditationLine: 'Recognized by UGC · NAAC Accredited',
    phone: '+91 98622 12345',
    email: 'office@dbctura.ac.in',
    website: 'www.dbctura.ac.in',
  },
  holder: {
    fullName: "Fr. Albert D'Souza",
    photoUrl: null,
    roleLabel: 'STAFF',
    employeeId: 'DBCST2024015',
    designation: 'Assistant Professor',
    department: 'Education',
    bloodGroup: 'O+',
    rfidNumber: 'RFID-00001234',
    emergencyContact: '9876543210',
    email: 'albert.dsouza@dbctura.ac.in',
    phone: '+91 98765 43210',
    joiningDate: '2024-01-15',
  },
  verification: {
    qrImageUrl: null,
    qrPayload: 'DBCST2024015',
    barcodeValue: 'DBCST2024015',
  },
  validity: {
    validFrom: '3 Jun 2026',
    validTo: '31 Dec 2029',
    validToLabel: 'VALID UP TO DEC 2029',
    validUntil: 'Dec 2029',
    courseCompletion: 'Dec 2029',
    expiryDate: 'Dec 2029',
  },
};

export function sampleModelForHolderType(holderType: string): IdCardModel {
  if (
    holderType === 'STAFF' ||
    holderType === 'CONTRACT' ||
    holderType === 'VISITING' ||
    holderType === 'RESEARCH'
  ) {
    return SAMPLE_STAFF_ID_CARD;
  }
  return SAMPLE_STUDENT_ID_CARD;
}

export function brandedSampleModel(
  holderType: string,
  branding?: InstitutionBranding | null,
): IdCardModel {
  const base = sampleModelForHolderType(holderType);
  if (!branding) return base;
  const doc = toBrandingDocumentContext(branding);
  const displayName = doc?.institutionName ?? branding.displayName ?? base.institution.displayName;
  const shortName =
    branding.shortName ??
    doc?.shortName ??
    displayName
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 8)
      .toUpperCase();

  const institution = {
    ...base.institution,
    displayName,
    shortName,
    logoUrl: doc?.logoUrl ?? resolveUploadAssetUrl(branding.logoUrl) ?? base.institution.logoUrl,
    address: doc?.address ?? branding.address ?? base.institution.address,
    campusName: doc?.campusName ?? branding.campusName ?? base.institution.campusName,
    primaryColor: doc?.primaryColor ?? branding.primaryColor ?? base.institution.primaryColor,
    accentColor: doc?.accentColor ?? branding.accentColor ?? base.institution.accentColor,
    affiliationLine: base.institution.affiliationLine,
    accreditationLine: base.institution.accreditationLine,
  };

  if (base.cardType === 'student') {
    return { ...base, institution, branding } satisfies StudentIdCardModel;
  }
  return { ...base, institution, branding } satisfies StaffIdCardModel;
}

export function previewModelForDesigner(
  previewId: 'student' | 'staff' | 'minimal',
  holderType: string,
  branding?: InstitutionBranding | null,
): IdCardModel {
  const effectiveHolder =
    previewId === 'staff' ? 'STAFF' : previewId === 'student' ? 'STUDENT' : holderType;
  const branded = brandedSampleModel(effectiveHolder, branding);

  if (previewId !== 'minimal') return branded;

  const inst = branded.institution;
  if (branded.cardType === 'student') {
    return {
      ...branded,
      institution: inst,
      holder: {
        ...branded.holder,
        fullName: 'Sample Name',
        displayFullName: 'Sample Name',
        rollNumber: 'ROLL-0000',
        registrationNumber: 'REG0000',
        department: 'Department',
        programme: 'Programme',
        gender: '—',
        fatherName: '—',
        motherName: '—',
        holderAddress: '—',
        bloodGroup: '—',
        rfidNumber: null,
        emergencyContact: '—',
      },
      verification: { qrImageUrl: null, qrPayload: 'SAMPLE-QR', barcodeValue: 'SAMPLE' },
    } satisfies StudentIdCardModel;
  }

  return {
    ...branded,
    institution: inst,
    holder: {
      ...branded.holder,
      fullName: 'Sample Name',
      employeeId: 'EMP-0000',
      designation: 'Designation',
      department: 'Department',
      bloodGroup: '—',
      rfidNumber: null,
      emergencyContact: '—',
    },
    verification: { qrImageUrl: null, qrPayload: 'SAMPLE-QR', barcodeValue: 'SAMPLE' },
  } satisfies StaffIdCardModel;
}
