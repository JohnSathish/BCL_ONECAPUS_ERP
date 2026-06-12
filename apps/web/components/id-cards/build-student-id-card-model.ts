import { toBrandingDocumentContext } from '@/lib/branding-document';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { LibraryQrPass } from '@/types/library';
import type { StudentIdCardModel } from '@/types/id-card';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';
import type { StudentDashboardView } from '@/types/student-portal';
import type { InstitutionBranding } from '@/types/branding';
import { formatPortalAddress } from './format-student-address';
import { abbreviateProgramme, isAcademicSessionText } from './id-card-programme-utils';
import { computeStudentCardValidity } from './id-card-validity-utils';

function safeAffiliationLine(branding?: InstitutionBranding | null): string | null {
  const sub = branding?.portalSubtitle?.trim();
  if (sub && !isAcademicSessionText(sub)) return sub;
  return null;
}

export function buildStudentIdCardModel(input: {
  dashboard?: StudentDashboardView | null;
  profile?: StudentPortalProfile360 | null;
  branding?: InstitutionBranding | null;
  qrPass?: LibraryQrPass | null;
}): StudentIdCardModel | null {
  const { dashboard, profile, branding, qrPass } = input;
  if (!dashboard?.profile && !profile) return null;

  const doc = toBrandingDocumentContext(branding ?? undefined);
  const p = profile?.personal;
  const dashProfile = dashboard?.profile;
  const academic = profile?.academic;

  const fullName = p?.displayFullName ?? p?.fullName ?? dashProfile?.fullName ?? 'Student';
  const rollNumber =
    p?.rollNumber ?? dashProfile?.enrollmentNumber ?? profile?.personal.enrollmentNumber ?? '—';
  const registrationNumber = p?.registrationNumber ?? null;
  const programmeRaw = academic?.programme ?? dashProfile?.programLabel ?? null;
  const validity = computeStudentCardValidity(
    academic?.batch ? { batch: academic.batch, programme: programmeRaw ?? undefined } : null,
  );

  const shortName =
    branding?.shortName ??
    doc?.shortName ??
    (doc?.institutionName ?? 'Institution')
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 8)
      .toUpperCase();

  return {
    cardType: 'student',
    institution: {
      displayName: doc?.institutionName ?? branding?.displayName ?? 'Institution',
      shortName,
      logoUrl: doc?.logoUrl ?? resolveUploadAssetUrl(branding?.logoUrl) ?? null,
      address: doc?.address ?? branding?.address ?? null,
      campusName: doc?.campusName ?? branding?.campusName ?? null,
      primaryColor: doc?.primaryColor ?? '#1e3a8a',
      accentColor: doc?.accentColor ?? '#7c3aed',
      affiliationLine: safeAffiliationLine(branding),
      accreditationLine: null,
    },
    holder: {
      fullName: p?.fullName ?? dashProfile?.fullName ?? fullName,
      displayFullName: fullName,
      photoUrl:
        (p?.photoUrl
          ? resolveUploadAssetUrl(p.photoUrl)
          : dashProfile?.photoUrl
            ? resolveUploadAssetUrl(dashProfile.photoUrl)
            : null) ?? null,
      roleLabel: 'STUDENT',
      subtitle: abbreviateProgramme(programmeRaw) ?? programmeRaw ?? 'Programme',
      rollNumber,
      registrationNumber,
      department: academic?.department ?? dashProfile?.department ?? null,
      programme: abbreviateProgramme(programmeRaw),
      semester: null,
      shift: academic?.shift ?? null,
      gender: p?.gender ?? null,
      fatherName: profile?.parents?.fatherName ?? null,
      motherName: profile?.parents?.motherName ?? null,
      holderAddress: formatPortalAddress(profile?.contact?.currentAddress),
      bloodGroup: p?.bloodGroup ?? null,
      rfidNumber: p?.rfidNumber ?? profile?.rfid.rfidNumber ?? null,
      emergencyContact:
        profile?.contact?.emergencyContact ??
        profile?.parents?.parentMobile ??
        profile?.parents?.fatherMobile ??
        profile?.parents?.motherMobile ??
        null,
    },
    verification: {
      qrImageUrl: qrPass?.qrImageUrl ?? null,
      qrPayload: qrPass?.payload ?? null,
      barcodeValue: rollNumber.replace(/\s+/g, ''),
    },
    validity,
    branding,
  };
}
