import type { IdCardFieldKey } from '@/types/id-card-template';

const VISIBLE_OVERFLOW_KEYS = new Set<IdCardFieldKey>([
  'contact',
  'terms',
  'emergencyContact',
  'programme',
  'verificationInfo',
  'registrationNumber',
  'department',
  'gender',
  'rfidNumber',
  'subtitle',
  'roleLabel',
  'name',
  'collegeAddress',
  'barcode',
  'employeeId',
  'designation',
  'email',
  'phone',
  'joiningDate',
  'affiliationLine',
  'accreditationLine',
  'validity',
  'principalSignature',
  'headerBand',
  'footerBand',
]);

export function idCardFieldOverflow(fieldKey?: IdCardFieldKey | string): 'hidden' | 'visible' {
  if (!fieldKey) return 'hidden';
  return VISIBLE_OVERFLOW_KEYS.has(fieldKey as IdCardFieldKey) ? 'visible' : 'hidden';
}
