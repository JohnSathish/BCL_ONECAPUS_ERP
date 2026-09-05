import { resolveSchoolCasteCategory } from './school-admission-category';
import {
  evaluateSchoolAgeEligibility,
  TPS_KG_2027_CENSUS_DATE,
  TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE,
  TPS_KG_2027_MIN_AGE_YEARS,
} from './school-age-eligibility';
import { SCHOOL_DOCUMENT_SLOTS } from './school-admissions-schema';
import {
  DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS,
  resolveApplicableSchoolCertificates,
} from './school-document-requirements';
import { isValidSchoolPinCode, schoolAddressPinCode } from './school-address-pin';
import type { SchoolApplicantMe } from '@/services/school-admissions';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getSchoolFormGaps(
  formData: Record<string, unknown> | null | undefined,
  settings?: {
    censusDate?: string;
    minAgeYears?: number;
    maxAgeYearsExclusive?: number;
    requireNursery?: boolean;
  } | null,
): string[] {
  const data = formData ?? {};
  const child = asRecord(data.child);
  const permanentAddress = asRecord(data.permanentAddress);
  const presentAddress = asRecord(data.presentAddress);
  const father = asRecord(data.father);
  const mother = asRecord(data.mother);
  const gaps: string[] = [];

  if (!text(child.fullName)) gaps.push('Child’s full name');
  if (!text(child.dateOfBirth)) {
    gaps.push('Date of birth');
  } else {
    const age = evaluateSchoolAgeEligibility(
      text(child.dateOfBirth),
      settings?.censusDate ?? TPS_KG_2027_CENSUS_DATE,
      settings?.minAgeYears ?? TPS_KG_2027_MIN_AGE_YEARS,
      settings?.maxAgeYearsExclusive ?? TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE,
    );
    if (!age.eligible) gaps.push(age.message);
  }
  if (!text(child.gender)) gaps.push('Gender');
  if (!text(child.bloodGroup)) gaps.push('Blood group');
  const category = resolveSchoolCasteCategory(child);
  if (!category) gaps.push('Caste / Category');
  if (category?.requireCommunity && !text(child.community)) {
    gaps.push('Community / Tribe (if applicable)');
  }
  if (!text(child.nationality)) gaps.push('Nationality');
  if (!text(child.lastSchool)) gaps.push('School last attended');
  if ((settings?.requireNursery ?? true) && child.attendedNursery !== true) {
    gaps.push('Nursery attendance confirmation');
  }

  if (!text(permanentAddress.village)) gaps.push('Permanent village');
  if (!text(permanentAddress.po)) gaps.push('Permanent P.O.');
  if (!text(permanentAddress.district)) gaps.push('Permanent district');
  if (!text(permanentAddress.state)) gaps.push('Permanent state');
  if (!isValidSchoolPinCode(schoolAddressPinCode(permanentAddress))) {
    gaps.push('Permanent PIN Code');
  }

  if (!text(presentAddress.po)) gaps.push('Present P.O.');
  if (!text(presentAddress.district)) gaps.push('Present district');
  if (!text(presentAddress.landmark)) gaps.push('Present landmark');
  if (!text(presentAddress.state)) gaps.push('Present state');
  if (!isValidSchoolPinCode(schoolAddressPinCode(presentAddress))) {
    gaps.push('Present PIN Code');
  }

  if (!text(father.fullName)) gaps.push('Father’s full name');
  if (!text(father.occupation)) gaps.push('Father’s occupation');
  if (!text(father.mobile) || text(father.mobile).length < 10) {
    gaps.push('Father’s mobile');
  }
  if (!text(mother.fullName)) gaps.push('Mother’s full name');
  if (!text(mother.occupation)) gaps.push('Mother’s occupation');
  if (!text(mother.mobile) || text(mother.mobile).length < 10) {
    gaps.push('Mother’s mobile');
  }

  return gaps;
}

export function schoolCertificateSlots(
  formData?: Record<string, unknown> | null,
  uploadedCodes: string[] = [],
  documentRequirements?: unknown,
) {
  const child = asRecord(formData?.child);
  const category = resolveSchoolCasteCategory(child);
  const applicable = resolveApplicableSchoolCertificates(formData, {
    categoryCode: category?.code ?? null,
    documentRequirements: documentRequirements ?? DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS,
  });
  const bySlot = new Map(applicable.map((item) => [item.slotCode, item]));

  return SCHOOL_DOCUMENT_SLOTS.filter((slot) => {
    if (slot.code === 'PAYMENT_RECEIPT') return false;
    if (
      slot.code === 'CASTE_CERT' ||
      slot.code === 'MOTHER_ST_CERT' ||
      slot.code === 'FATHER_SC_OBC_CERT'
    ) {
      return bySlot.has(slot.code) || uploadedCodes.includes(slot.code);
    }
    return true;
  }).map((slot) => {
    const conditional = bySlot.get(
      slot.code as 'CASTE_CERT' | 'MOTHER_ST_CERT' | 'FATHER_SC_OBC_CERT',
    );
    if (conditional) {
      return {
        ...slot,
        required: conditional.required,
        optional: !conditional.required,
        label: conditional.label,
        hint: conditional.helperText,
      };
    }
    if (
      (slot.code === 'CASTE_CERT' ||
        slot.code === 'MOTHER_ST_CERT' ||
        slot.code === 'FATHER_SC_OBC_CERT') &&
      uploadedCodes.includes(slot.code)
    ) {
      return {
        ...slot,
        required: false,
        optional: false,
        label: slot.label,
        hint: 'Already uploaded — not required for the current Community / Category.',
      };
    }
    return {
      ...slot,
      required: slot.required,
      optional: !slot.required,
      hint: undefined as string | undefined,
    };
  });
}

export function schoolApplicationProgress(me?: SchoolApplicantMe | null) {
  const formData = me?.application.formData ?? {};
  const workflow = asRecord(formData.workflow);
  const formGaps = getSchoolFormGaps(formData, me?.settings);
  const formDone = workflow.formComplete === true || formGaps.length === 0;
  const documents = me?.application.documents ?? [];
  const uploadedCodes = documents.map((doc) => doc.slotCode);
  const certificateSlots = schoolCertificateSlots(
    formData,
    uploadedCodes,
    me?.settings?.documentRequirements,
  );
  const requiredSlots = certificateSlots.filter((slot) => slot.required);
  const uploadedRequired = requiredSlots.filter((slot) =>
    documents.some((doc) => doc.slotCode === slot.code),
  );
  const docsDone = uploadedRequired.length >= requiredSlots.length;
  const hasBankTxn = Boolean(me?.application.paymentReference?.trim());
  const receiptOk = ['UPLOADED', 'UPLOADED_PENDING', 'VERIFIED'].includes(
    me?.paymentProofStatus ?? '',
  );
  const paymentDone = hasBankTxn && receiptOk;
  const submitted = Boolean(me?.application.status && me.application.status !== 'draft');
  return {
    formDone,
    docsDone,
    paymentDone,
    submitted,
    formGaps,
    certificatesUploaded: uploadedRequired.length,
    certificatesRequired: requiredSlots.length,
  };
}
