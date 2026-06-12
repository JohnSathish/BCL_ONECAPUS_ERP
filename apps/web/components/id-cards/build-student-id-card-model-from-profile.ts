import { toBrandingDocumentContext } from '@/lib/branding-document';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { InstitutionBranding } from '@/types/branding';
import type { StudentIdCardModel } from '@/types/id-card';
import type { StudentProfile } from '@/types/students';
import { formatStudentAddresses } from './format-student-address';
import { abbreviateProgramme, isAcademicSessionText } from './id-card-programme-utils';
import { computeStudentCardValidity } from './id-card-validity-utils';

function studentQrPayload(enrollmentNumber: string) {
  return `LIB:E:${enrollmentNumber}`;
}

function studentQrImageUrl(enrollmentNumber: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(studentQrPayload(enrollmentNumber))}`;
}

function safeAffiliationLine(branding?: InstitutionBranding | null): string | null {
  const sub = branding?.portalSubtitle?.trim();
  if (sub && !isAcademicSessionText(sub)) return sub;
  return null;
}

function emergencyContactFromProfile(profile: StudentProfile): string | null {
  const father = profile.guardians?.find((g) => g.guardianType.toUpperCase() === 'FATHER');
  const mother = profile.guardians?.find((g) => g.guardianType.toUpperCase() === 'MOTHER');
  return (
    father?.contactNumber ??
    mother?.contactNumber ??
    profile.guardians?.find((g) => g.contactNumber)?.contactNumber ??
    null
  );
}

export function buildStudentIdCardModelFromProfile(input: {
  profile: StudentProfile;
  branding?: InstitutionBranding | null;
}): StudentIdCardModel {
  const { profile, branding } = input;
  const doc = toBrandingDocumentContext(branding ?? undefined);
  const fullName = profile.displayFullName ?? profile.fullName;
  const rollNumber = profile.rollNumber ?? profile.enrollmentNumber;
  const programmeRaw = profile.programme ?? profile.majorSubject ?? null;
  const validity = computeStudentCardValidity(profile);

  const shortName =
    branding?.shortName ??
    doc?.shortName ??
    (doc?.institutionName ?? 'Institution')
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 8)
      .toUpperCase();

  const enrollmentNumber = profile.enrollmentNumber;
  const regNo =
    profile.enrollmentNumber ?? profile.admissionNumber ?? profile.applicationNumber ?? null;
  const barcodeValue = (regNo ?? rollNumber).replace(/\s+/g, '');
  const father = profile.guardians?.find((g) => g.guardianType.toUpperCase() === 'FATHER');
  const mother = profile.guardians?.find((g) => g.guardianType.toUpperCase() === 'MOTHER');

  return {
    cardType: 'student',
    institution: {
      displayName: doc?.institutionName ?? branding?.displayName ?? 'Institution',
      shortName,
      logoUrl: doc?.logoUrl ?? resolveUploadAssetUrl(branding?.logoUrl) ?? null,
      address: doc?.address ?? branding?.address ?? null,
      campusName: doc?.campusName ?? branding?.campusName ?? null,
      primaryColor: doc?.primaryColor ?? '#001B44',
      accentColor: doc?.accentColor ?? '#8B1538',
      affiliationLine: safeAffiliationLine(branding),
      accreditationLine: null,
    },
    holder: {
      fullName: profile.fullName,
      displayFullName: fullName,
      photoUrl: profile.photoPath ? (resolveUploadAssetUrl(profile.photoPath) ?? null) : null,
      roleLabel: 'STUDENT',
      subtitle: abbreviateProgramme(programmeRaw) ?? programmeRaw ?? 'Programme',
      rollNumber,
      registrationNumber: regNo,
      department: profile.departmentName ?? profile.majorSubject ?? null,
      programme: abbreviateProgramme(programmeRaw) ?? programmeRaw,
      semester: null,
      shift: profile.shift ?? null,
      gender: profile.gender ?? null,
      fatherName: father?.fullName ?? null,
      motherName: mother?.fullName ?? null,
      holderAddress: formatStudentAddresses(profile.addresses),
      bloodGroup: profile.bloodGroup ?? null,
      rfidNumber: profile.rfidNumber ?? null,
      emergencyContact: emergencyContactFromProfile(profile),
    },
    verification: {
      qrImageUrl: studentQrImageUrl(enrollmentNumber),
      qrPayload: studentQrPayload(enrollmentNumber),
      barcodeValue,
    },
    validity,
    branding,
  };
}
