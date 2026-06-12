export type BulkUpdateFieldPermission = 'personal' | 'academic' | 'subjects';

export type BulkUpdateInputType =
  | 'text'
  | 'select'
  | 'textarea'
  | 'lookup'
  | 'date'
  | 'boolean'
  | 'subject';

export type BulkUpdateFieldDef = {
  fieldKey: string;
  sectionKey: string;
  label: string;
  group: string;
  inputType: BulkUpdateInputType;
  permission: BulkUpdateFieldPermission;
  supportsAppend: boolean;
  lookupType?: string;
  nepCategory?: string;
};

export const BULK_UPDATE_FIELD_CATALOG: BulkUpdateFieldDef[] = [
  {
    fieldKey: 'fullName',
    sectionKey: 'basic',
    label: 'Full Name',
    group: 'Personal',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'mobileNumber',
    sectionKey: 'basic',
    label: 'Mobile Number',
    group: 'Personal',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'email',
    sectionKey: 'basic',
    label: 'Email',
    group: 'Personal',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'dateOfBirth',
    sectionKey: 'basic',
    label: 'Date of Birth',
    group: 'Personal',
    inputType: 'date',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'gender',
    sectionKey: 'basic',
    label: 'Gender',
    group: 'Personal',
    inputType: 'select',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'bloodGroupLookupId',
    sectionKey: 'basic',
    label: 'Blood Group',
    group: 'Personal',
    inputType: 'lookup',
    permission: 'personal',
    supportsAppend: false,
    lookupType: 'BLOOD_GROUP',
  },
  {
    fieldKey: 'categoryLookupId',
    sectionKey: 'category_reservation',
    label: 'Category',
    group: 'Category',
    inputType: 'lookup',
    permission: 'personal',
    supportsAppend: false,
    lookupType: 'RESERVATION_CATEGORY',
  },
  {
    fieldKey: 'religionLookupId',
    sectionKey: 'category_reservation',
    label: 'Religion',
    group: 'Category',
    inputType: 'lookup',
    permission: 'personal',
    supportsAppend: false,
    lookupType: 'RELIGION',
  },
  {
    fieldKey: 'tribeLookupId',
    sectionKey: 'category_reservation',
    label: 'Tribe',
    group: 'Category',
    inputType: 'lookup',
    permission: 'personal',
    supportsAppend: false,
    lookupType: 'TRIBE',
  },
  {
    fieldKey: 'ews',
    sectionKey: 'category_reservation',
    label: 'EWS',
    group: 'Category',
    inputType: 'boolean',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'differentlyAbled',
    sectionKey: 'category_reservation',
    label: 'Differently Abled',
    group: 'Category',
    inputType: 'boolean',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'turaAddress',
    sectionKey: 'address',
    label: 'Tura Address',
    group: 'Address',
    inputType: 'textarea',
    permission: 'personal',
    supportsAppend: true,
  },
  {
    fieldKey: 'homeAddress',
    sectionKey: 'address',
    label: 'Home Address',
    group: 'Address',
    inputType: 'textarea',
    permission: 'personal',
    supportsAppend: true,
  },
  {
    fieldKey: 'fatherName',
    sectionKey: 'guardians',
    label: 'Father Name',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'fatherPhone',
    sectionKey: 'guardians',
    label: 'Father Phone',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'fatherOccupation',
    sectionKey: 'guardians',
    label: 'Father Occupation',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'motherName',
    sectionKey: 'guardians',
    label: 'Mother Name',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'motherPhone',
    sectionKey: 'guardians',
    label: 'Mother Phone',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'guardianName',
    sectionKey: 'guardians',
    label: 'Guardian Name',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'guardianPhone',
    sectionKey: 'guardians',
    label: 'Guardian Phone',
    group: 'Family',
    inputType: 'text',
    permission: 'personal',
    supportsAppend: false,
  },
  {
    fieldKey: 'programVersionId',
    sectionKey: 'academic',
    label: 'Programme Version',
    group: 'Academic',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'streamId',
    sectionKey: 'academic',
    label: 'Stream',
    group: 'Academic',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'admissionBatchId',
    sectionKey: 'academic',
    label: 'Batch',
    group: 'Academic',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'majorSubjectSlug',
    sectionKey: 'academic',
    label: 'Major',
    group: 'Academic',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'minorSubjectSlug',
    sectionKey: 'academic',
    label: 'Minor',
    group: 'Academic',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'residenceType',
    sectionKey: 'academic',
    label: 'Residence Type',
    group: 'Hostel',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'hostelBlock',
    sectionKey: 'academic',
    label: 'Hostel Block',
    group: 'Hostel',
    inputType: 'text',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'hostelRoom',
    sectionKey: 'academic',
    label: 'Hostel Room',
    group: 'Hostel',
    inputType: 'text',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'primaryShiftId',
    sectionKey: 'basic',
    label: 'Shift',
    group: 'Academic',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'rollNumber',
    sectionKey: 'basic',
    label: 'Roll Number',
    group: 'Identity',
    inputType: 'text',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'enrollmentNumber',
    sectionKey: 'basic',
    label: 'Registration Number',
    group: 'Identity',
    inputType: 'text',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'studentStatus',
    sectionKey: 'basic',
    label: 'Student Status',
    group: 'Identity',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'admissionStatus',
    sectionKey: 'basic',
    label: 'Admission Status',
    group: 'Admission',
    inputType: 'select',
    permission: 'academic',
    supportsAppend: false,
  },
  {
    fieldKey: 'MDC',
    sectionKey: 'fyugp_registration',
    label: 'MDC',
    group: 'NEP Subjects',
    inputType: 'subject',
    permission: 'subjects',
    supportsAppend: false,
    nepCategory: 'MDC',
  },
  {
    fieldKey: 'AEC',
    sectionKey: 'fyugp_registration',
    label: 'AEC',
    group: 'NEP Subjects',
    inputType: 'subject',
    permission: 'subjects',
    supportsAppend: false,
    nepCategory: 'AEC',
  },
  {
    fieldKey: 'SEC',
    sectionKey: 'fyugp_registration',
    label: 'SEC',
    group: 'NEP Subjects',
    inputType: 'subject',
    permission: 'subjects',
    supportsAppend: false,
    nepCategory: 'SEC',
  },
  {
    fieldKey: 'VAC',
    sectionKey: 'fyugp_registration',
    label: 'VAC',
    group: 'NEP Subjects',
    inputType: 'subject',
    permission: 'subjects',
    supportsAppend: false,
    nepCategory: 'VAC',
  },
  {
    fieldKey: 'VTC',
    sectionKey: 'fyugp_registration',
    label: 'VTC',
    group: 'NEP Subjects',
    inputType: 'subject',
    permission: 'subjects',
    supportsAppend: false,
    nepCategory: 'VTC',
  },
];

export const BULK_UPDATE_FIELD_MAP = new Map(
  BULK_UPDATE_FIELD_CATALOG.map((f) => [f.fieldKey, f]),
);

export function getBulkUpdateFieldsGrouped() {
  const groups = new Map<string, BulkUpdateFieldDef[]>();
  for (const field of BULK_UPDATE_FIELD_CATALOG) {
    const list = groups.get(field.group) ?? [];
    list.push(field);
    groups.set(field.group, list);
  }
  return [...groups.entries()].map(([group, fields]) => ({ group, fields }));
}

export function serializeFieldValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
