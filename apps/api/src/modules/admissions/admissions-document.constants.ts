export const APPLICANT_DOCUMENT_SLOTS = [
  { code: 'PHOTO', label: 'Profile Photo', required: true },
  { code: 'STD10', label: 'STD X Marksheet', required: true },
  { code: 'STD12', label: 'STD XII Marksheet', required: true },
  { code: 'CUET', label: 'CUET Marksheet', required: false },
  { code: 'DISABILITY', label: 'Disability Certificate', required: false },
  { code: 'EWS', label: 'EWS Certificate', required: false },
] as const;

export type ApplicantDocumentSlotCode =
  (typeof APPLICANT_DOCUMENT_SLOTS)[number]['code'];

export function resolveRequiredDocumentSlots(
  formData?: Record<string, unknown> | null,
) {
  const personal = (formData?.personal ?? {}) as { category?: string };
  const required: ApplicantDocumentSlotCode[] = APPLICANT_DOCUMENT_SLOTS.filter(
    (slot) => slot.required,
  ).map((slot) => slot.code);

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

export function formatMissingDocumentLabels(missingCodes: string[]): string {
  const labels = new Map(
    APPLICANT_DOCUMENT_SLOTS.map((slot) => [slot.code, slot.label]),
  );
  return missingCodes
    .map((code) => labels.get(code as ApplicantDocumentSlotCode) ?? code)
    .join(', ');
}
