export const APPLICANT_FORM_STEPS = [
  {
    id: 1,
    key: 'personal',
    title: 'Personal Information',
    short: 'Personal',
    hint: 'Applicant basic details',
  },
  {
    id: 2,
    key: 'addresses',
    title: 'Addresses & Identity',
    short: 'Address',
    hint: 'Contact information and identification',
  },
  {
    id: 3,
    key: 'family',
    title: 'Family & Guardian',
    short: 'Family',
    hint: 'Parent and guardian contact information',
  },
  {
    id: 4,
    key: 'academic',
    title: 'Academic Records',
    short: 'Academic',
    hint: 'Class XI/XII subjects and examination details',
  },
  {
    id: 5,
    key: 'coursePreferences',
    title: 'Course Preferences',
    short: 'Courses',
    hint: 'Select first semester course combinations',
  },
  {
    id: 6,
    key: 'uploads',
    title: 'Uploads & Declaration',
    short: 'Uploads',
    hint: 'Upload marksheets and confirm declaration',
  },
  { id: 7, key: 'declaration', title: 'Declaration', short: 'Submit', hint: 'Review and submit' },
] as const;

export const DOC_SLOTS = [
  { code: 'PHOTO', label: 'Profile Photo', required: true },
  { code: 'STD10', label: 'STD X Marksheet (jpeg/jpg/png)', required: true },
  { code: 'STD12', label: 'STD XII Marksheet (jpeg/jpg/png)', required: true },
  { code: 'CUET', label: 'CUET Marksheet', required: false },
  { code: 'DISABILITY', label: 'Disability Certificate', required: false },
  { code: 'EWS', label: 'Economically Weaker Section Proof', required: false },
] as const;

/** Document slots shown in step 6 (photo collected at registration) */
export const UPLOAD_DOC_SLOTS = DOC_SLOTS.filter((d) => d.code !== 'PHOTO');

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const CATEGORY_OPTIONS = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;

export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Divorced'] as const;

export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const RELIGION_OPTIONS = [
  'Christian',
  'Hindu',
  'Muslim',
  'Sikh',
  'Buddhist',
  'Other',
] as const;

export function stepProgressPercent(step: number) {
  return Math.min(100, Math.round((step / 7) * 100));
}

export function resolveRequiredDocumentSlots(formData?: Record<string, unknown> | null) {
  const personal = (formData?.personal ?? {}) as { category?: string };
  const required: string[] = DOC_SLOTS.filter((slot) => slot.required).map((slot) => slot.code);
  if (personal.category === 'EWS') {
    required.push('EWS');
  }
  return [...new Set(required)];
}

export function findMissingRequiredDocuments(
  uploadedSlotCodes: string[],
  formData?: Record<string, unknown> | null,
) {
  const required = resolveRequiredDocumentSlots(formData);
  const uploaded = new Set(uploadedSlotCodes);
  return required.filter((code) => !uploaded.has(code));
}
