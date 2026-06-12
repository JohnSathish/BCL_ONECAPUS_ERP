export const ADMISSION_DOCUMENT_SLOTS = [
  {
    type: 'MARKSHEETS_STD_X_ONWARDS',
    label: 'Certificates & mark sheets (Std. X onwards)',
    description: 'Attested copies from Class X onwards, including Class XII.',
    multiple: true,
  },
  {
    type: 'CUET_CERTIFICATE',
    label: 'CUET certificate',
    description: 'Required if CUET was applied.',
    whenCuet: true,
  },
  {
    type: 'CATEGORY_CERTIFICATE',
    label: 'ST / SC / BC / OBC certificate',
    description: 'Reservation or category certificate, if applicable.',
  },
  {
    type: 'AGE_CERTIFICATE',
    label: 'Age certificate / Class X admit card',
    description: 'Proof of date of birth.',
  },
  {
    type: 'BAPTISM_CERTIFICATE',
    label: 'Baptism certificate',
    description: 'For Catholic students, if applicable.',
    optional: true,
  },
] as const;

export type AdmissionDocumentType = (typeof ADMISSION_DOCUMENT_SLOTS)[number]['type'];

export function admissionDocumentLabel(documentType: string): string {
  return (
    ADMISSION_DOCUMENT_SLOTS.find((s) => s.type === documentType)?.label ??
    documentType.replace(/_/g, ' ')
  );
}
