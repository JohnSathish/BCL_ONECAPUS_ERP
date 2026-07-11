export type ProfileApprovalMode =
  | 'AUTO_APPROVE'
  | 'APPROVAL_REQUIRED'
  | 'VERIFICATION_REQUIRED'
  | 'READ_ONLY';

export type ProfilePolicySeed = {
  sectionKey: string;
  fieldKey: string;
  approvalMode: ProfileApprovalMode;
  mandatory?: boolean;
  sortOrder?: number;
};

/** DBC-style defaults from the Profile Update & Verification spec. */
export const DEFAULT_PROFILE_UPDATE_POLICIES: ProfilePolicySeed[] = [
  // Personal
  {
    sectionKey: 'personal',
    fieldKey: 'fullName',
    approvalMode: 'APPROVAL_REQUIRED',
    mandatory: true,
    sortOrder: 10,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'mobileNumber',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 20,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'alternateMobile',
    approvalMode: 'AUTO_APPROVE',
    sortOrder: 25,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'email',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 30,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'dateOfBirth',
    approvalMode: 'APPROVAL_REQUIRED',
    mandatory: true,
    sortOrder: 40,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'gender',
    approvalMode: 'APPROVAL_REQUIRED',
    sortOrder: 50,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'bloodGroupLookupId',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 60,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'nationalityLookupId',
    approvalMode: 'AUTO_APPROVE',
    sortOrder: 70,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'religionLookupId',
    approvalMode: 'AUTO_APPROVE',
    sortOrder: 80,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'categoryLookupId',
    approvalMode: 'APPROVAL_REQUIRED',
    sortOrder: 90,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'maritalStatus',
    approvalMode: 'AUTO_APPROVE',
    sortOrder: 100,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'nationalId',
    approvalMode: 'APPROVAL_REQUIRED',
    mandatory: true,
    sortOrder: 110,
  },
  {
    sectionKey: 'personal',
    fieldKey: 'panNumber',
    approvalMode: 'APPROVAL_REQUIRED',
    sortOrder: 120,
  },
  // Contact
  {
    sectionKey: 'contact',
    fieldKey: 'mobileNumber',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 10,
  },
  {
    sectionKey: 'contact',
    fieldKey: 'whatsappNumber',
    approvalMode: 'AUTO_APPROVE',
    sortOrder: 20,
  },
  {
    sectionKey: 'contact',
    fieldKey: 'email',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 30,
  },
  {
    sectionKey: 'contact',
    fieldKey: 'emergencyContactMobile',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 40,
  },
  // Address
  {
    sectionKey: 'address',
    fieldKey: 'current',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 10,
  },
  {
    sectionKey: 'address',
    fieldKey: 'permanent',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 20,
  },
  // Guardians
  {
    sectionKey: 'guardians',
    fieldKey: 'FATHER',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 10,
  },
  {
    sectionKey: 'guardians',
    fieldKey: 'MOTHER',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 20,
  },
  {
    sectionKey: 'guardians',
    fieldKey: 'GUARDIAN',
    approvalMode: 'AUTO_APPROVE',
    sortOrder: 30,
  },
  // Bank
  {
    sectionKey: 'bank',
    fieldKey: 'bankDetails',
    approvalMode: 'APPROVAL_REQUIRED',
    mandatory: true,
    sortOrder: 10,
  },
  // Emergency
  {
    sectionKey: 'emergency',
    fieldKey: 'emergencyContact',
    approvalMode: 'AUTO_APPROVE',
    mandatory: true,
    sortOrder: 10,
  },
  // Class XII
  {
    sectionKey: 'class_xii',
    fieldKey: 'boardExam',
    approvalMode: 'APPROVAL_REQUIRED',
    mandatory: true,
    sortOrder: 10,
  },
  {
    sectionKey: 'class_xii',
    fieldKey: 'subjectMarks',
    approvalMode: 'APPROVAL_REQUIRED',
    mandatory: true,
    sortOrder: 20,
  },
  // Documents
  {
    sectionKey: 'documents',
    fieldKey: 'PHOTO',
    approvalMode: 'VERIFICATION_REQUIRED',
    mandatory: true,
    sortOrder: 10,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'SIGNATURE',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 20,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'AADHAAR',
    approvalMode: 'VERIFICATION_REQUIRED',
    mandatory: true,
    sortOrder: 30,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'PAN',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 40,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'CLASS_XII_MARKSHEET',
    approvalMode: 'VERIFICATION_REQUIRED',
    mandatory: true,
    sortOrder: 50,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'CLASS_XII_PASSING',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 60,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'MIGRATION',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 70,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'CHARACTER',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 80,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'TC',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 90,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'INCOME',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 100,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'COMMUNITY',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 110,
  },
  {
    sectionKey: 'documents',
    fieldKey: 'DISABILITY',
    approvalMode: 'VERIFICATION_REQUIRED',
    sortOrder: 120,
  },
];

export const STUDENT_EDITABLE_SECTIONS = [
  'personal',
  'contact',
  'address',
  'guardians',
  'bank',
  'emergency',
  'class_xii',
  'documents',
] as const;

/** Temporarily hide Bank from student UIs until the college needs it. */
export const BANK_SECTION_VISIBLE = false;

export const DEFAULT_PROFILE_CLOSED_MESSAGE =
  'The profile update period has ended. Please contact the College Office if you need to make any changes.';

export const PROFILE_COMPLETION_CHECKS: Array<{
  key: string;
  label: string;
  sectionKey: string;
  fieldKey: string;
}> = [
  {
    key: 'aadhaar',
    label: 'Aadhaar Number',
    sectionKey: 'personal',
    fieldKey: 'nationalId',
  },
  {
    key: 'bloodGroup',
    label: 'Blood Group',
    sectionKey: 'personal',
    fieldKey: 'bloodGroupLookupId',
  },
  {
    key: 'mobile',
    label: 'Mobile Number',
    sectionKey: 'personal',
    fieldKey: 'mobileNumber',
  },
  {
    key: 'email',
    label: 'Personal Email',
    sectionKey: 'personal',
    fieldKey: 'email',
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    sectionKey: 'personal',
    fieldKey: 'dateOfBirth',
  },
  {
    key: 'fatherMobile',
    label: 'Parent Mobile Number',
    sectionKey: 'guardians',
    fieldKey: 'FATHER',
  },
  {
    key: 'address',
    label: 'Address Details',
    sectionKey: 'address',
    fieldKey: 'current',
  },
  {
    key: 'bank',
    label: 'Bank Details',
    sectionKey: 'bank',
    fieldKey: 'bankDetails',
  },
  {
    key: 'classXii',
    label: 'Class XII Marks',
    sectionKey: 'class_xii',
    fieldKey: 'boardExam',
  },
  {
    key: 'photo',
    label: 'Passport Photo',
    sectionKey: 'documents',
    fieldKey: 'PHOTO',
  },
  {
    key: 'marksheet',
    label: 'Class XII Marksheet',
    sectionKey: 'documents',
    fieldKey: 'CLASS_XII_MARKSHEET',
  },
];

export const PORTAL_DOCUMENT_TYPES = [
  'PHOTO',
  'SIGNATURE',
  'AADHAAR',
  'PAN',
  'CLASS_XII_MARKSHEET',
  'CLASS_XII_PASSING',
  'MIGRATION',
  'CHARACTER',
  'TC',
  'INCOME',
  'COMMUNITY',
  'DISABILITY',
  'OTHER',
] as const;
