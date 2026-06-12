export const PROFILE_SECTION_KEYS = [
  'basic',
  'academic',
  'fyugp_registration',
  'category_reservation',
  'address',
  'guardians',
  'board_exam',
  'cuet',
  'documents',
  'system',
] as const;

export type ProfileSectionKey = (typeof PROFILE_SECTION_KEYS)[number];

export function isProfileSectionKey(value: string): value is ProfileSectionKey {
  return (PROFILE_SECTION_KEYS as readonly string[]).includes(value);
}

export type ProfileFieldDef = {
  fieldKey: string;
  required?: boolean;
  sortOrder: number;
};

export type ProfileSectionDef = {
  key: ProfileSectionKey;
  label: string;
  fields: ProfileFieldDef[];
};

export const DEFAULT_PROFILE_SECTIONS: ProfileSectionDef[] = [
  {
    key: 'basic',
    label: 'Basic Information',
    fields: [
      { fieldKey: 'applicationNumber', sortOrder: 1 },
      { fieldKey: 'admissionNumber', sortOrder: 2 },
      { fieldKey: 'enrollmentNumber', required: true, sortOrder: 3 },
      { fieldKey: 'rollNumber', sortOrder: 4 },
      { fieldKey: 'fullName', required: true, sortOrder: 5 },
      { fieldKey: 'email', required: true, sortOrder: 6 },
      { fieldKey: 'mobileNumber', sortOrder: 7 },
      { fieldKey: 'dateOfBirth', sortOrder: 8 },
      { fieldKey: 'gender', sortOrder: 9 },
      { fieldKey: 'maritalStatus', sortOrder: 10 },
      { fieldKey: 'bloodGroupLookupId', sortOrder: 11 },
      { fieldKey: 'photoPath', sortOrder: 12 },
      { fieldKey: 'studentStatus', sortOrder: 13 },
    ],
  },
  {
    key: 'academic',
    label: 'Academic Information',
    fields: [
      { fieldKey: 'programVersionId', required: true, sortOrder: 1 },
      { fieldKey: 'streamId', sortOrder: 2 },
      { fieldKey: 'admissionBatchId', sortOrder: 3 },
      { fieldKey: 'majorSubjectSlug', sortOrder: 4 },
      { fieldKey: 'minorSubjectSlug', sortOrder: 5 },
    ],
  },
  {
    key: 'category_reservation',
    label: 'Category & Reservation',
    fields: [
      { fieldKey: 'categoryLookupId', sortOrder: 1 },
      { fieldKey: 'religionLookupId', sortOrder: 2 },
      { fieldKey: 'tribeLookupId', sortOrder: 3 },
      { fieldKey: 'denominationLookupId', sortOrder: 4 },
      { fieldKey: 'differentlyAbled', sortOrder: 5 },
      { fieldKey: 'ews', sortOrder: 6 },
    ],
  },
  {
    key: 'address',
    label: 'Address Information',
    fields: [
      { fieldKey: 'turaAddress', sortOrder: 1 },
      { fieldKey: 'homeAddress', sortOrder: 2 },
    ],
  },
  {
    key: 'guardians',
    label: 'Parent / Guardian Information',
    fields: [
      { fieldKey: 'father', sortOrder: 1 },
      { fieldKey: 'mother', sortOrder: 2 },
      { fieldKey: 'localGuardian', sortOrder: 3 },
    ],
  },
  {
    key: 'board_exam',
    label: 'Board Examination Details',
    fields: [
      { fieldKey: 'boardName', sortOrder: 1 },
      { fieldKey: 'boardRollNumber', sortOrder: 2 },
      { fieldKey: 'subjectMarks', required: true, sortOrder: 3 },
    ],
  },
  {
    key: 'cuet',
    label: 'CUET Information',
    fields: [
      { fieldKey: 'cuetApplied', sortOrder: 1 },
      { fieldKey: 'cuetRollNumber', sortOrder: 2 },
    ],
  },
];

export function flattenDefaultFieldConfigs(
  institutionId: string,
  tenantId: string,
) {
  const rows: {
    tenantId: string;
    institutionId: string;
    sectionKey: string;
    fieldKey: string;
    visible: boolean;
    required: boolean;
    editable: boolean;
    studentEditable: boolean;
    sortOrder: number;
  }[] = [];

  for (const section of DEFAULT_PROFILE_SECTIONS) {
    for (const field of section.fields) {
      rows.push({
        tenantId,
        institutionId,
        sectionKey: section.key,
        fieldKey: field.fieldKey,
        visible: true,
        required: field.required ?? false,
        editable: true,
        studentEditable: false,
        sortOrder: field.sortOrder,
      });
    }
  }
  return rows;
}
