export type ProfileSectionKey =
  | 'basic'
  | 'academic'
  | 'fyugp_registration'
  | 'category_reservation'
  | 'address'
  | 'guardians'
  | 'board_exam'
  | 'cuet'
  | 'documents'
  | 'system';

export type ProfileTabKey =
  | 'overview'
  | 'academic'
  | 'subjects'
  | 'attendance'
  | 'fees'
  | 'documents'
  | 'communication'
  | 'rfid'
  | 'id-card'
  | 'certificates'
  | 'library'
  | 'promotion'
  | 'remarks'
  | 'audit';

export const PROFILE_TABS: { key: ProfileTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'academic', label: 'Academic' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'fees', label: 'Fees' },
  { key: 'documents', label: 'Documents' },
  { key: 'id-card', label: 'ID Card' },
  { key: 'communication', label: 'Communication' },
  { key: 'rfid', label: 'RFID' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'library', label: 'Library' },
  { key: 'promotion', label: 'Promotion' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'audit', label: 'Audit' },
];

/** Maps legacy `?section=` query values to profile tabs */
export const LEGACY_SECTION_TO_TAB: Record<ProfileSectionKey, ProfileTabKey> = {
  basic: 'overview',
  category_reservation: 'overview',
  address: 'overview',
  guardians: 'overview',
  academic: 'academic',
  fyugp_registration: 'subjects',
  board_exam: 'academic',
  cuet: 'academic',
  documents: 'documents',
  system: 'audit',
};

export const PROFILE_SECTIONS: { key: ProfileSectionKey; label: string }[] = [
  { key: 'basic', label: 'Basic Information' },
  { key: 'academic', label: 'Academic Information' },
  { key: 'fyugp_registration', label: 'FYUGP Subject Registration' },
  { key: 'category_reservation', label: 'Category & Reservation' },
  { key: 'address', label: 'Address Information' },
  { key: 'guardians', label: 'Parent / Guardian' },
  { key: 'board_exam', label: 'Board Examination' },
  { key: 'cuet', label: 'CUET Information' },
  { key: 'documents', label: 'Documents & Verification' },
  { key: 'system', label: 'System Information' },
];

export type ProfileCompletion = {
  completionPercent: number;
  sections: Record<string, { complete: boolean; filled: number; total: number }>;
};

export type StudentAddress = {
  id: string;
  addressType: string;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  pinCode?: string | null;
};

export type StudentGuardian = {
  id: string;
  guardianType: string;
  fullName?: string | null;
  age?: number | null;
  occupation?: string | null;
  contactNumber?: string | null;
  email?: string | null;
};

export type BoardSubjectMark = {
  id: string;
  subjectName: string;
  marksObtained?: number | null;
  maxMarks?: number | null;
  sortOrder: number;
};

export type StudentBoardExam = {
  id: string;
  boardName?: string | null;
  schoolName?: string | null;
  boardRollNumber?: string | null;
  examYear?: number | null;
  stream?: string | null;
  registrationType?: string | null;
  totalMarks?: number | null;
  percentage?: string | number | null;
  division?: string | null;
  marksheetDocumentId?: string | null;
  subjectMarks: BoardSubjectMark[];
};

export type StudentCuetDetail = {
  id: string;
  cuetApplied: boolean;
  cuetRollNumber?: string | null;
  cuetScore?: string | number | null;
  cuetSubjects?: unknown;
};

export type StudentDocumentRecord = {
  id: string;
  documentType: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  verificationStatus?: string;
  verificationRemarks?: string | null;
  verifiedAt?: string | null;
};

export type ProgramChoice = {
  id: string;
  choiceType: string;
  subjectSlug: string;
  subjectName?: string;
};

export type NepCategoryGroups = {
  major: { code: string; title: string }[];
  minor: { code: string; title: string }[];
  mdc: { code: string; title: string }[];
  aec: { code: string; title: string }[];
  sec: { code: string; title: string }[];
  vac: { code: string; title: string }[];
  vtc: { code: string; title: string }[];
};
