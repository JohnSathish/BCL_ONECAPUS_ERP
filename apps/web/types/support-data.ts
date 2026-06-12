export type SupportDataFieldDef = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type SupportDataCategoryMeta = {
  code: string;
  label: string;
  group: string;
  source: 'lookup' | 'dedicated';
  permissions: string[];
  fields: SupportDataFieldDef[];
  features: {
    search: boolean;
    reorder: boolean;
    import: boolean;
    export: boolean;
    campusScope: boolean;
  };
  lookupType?: string;
};

export type SupportDataGroup = {
  code: string;
  label: string;
  categories: {
    code: string;
    label: string;
    source: string;
    features: SupportDataCategoryMeta['features'];
    fields: SupportDataFieldDef[];
  }[];
};

export type SupportDataRow = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
};

export type BoardSubjectRow = SupportDataRow & {
  metadata?: {
    subjectName?: string;
    subjectCode?: string;
    category?: string;
    boardType?: string;
    status?: string;
    [key: string]: unknown;
  };
};

export const LOOKUP_CATEGORY_TO_TYPE: Record<string, string> = {
  'staff-types': 'STAFF_TYPE',
  'employment-types': 'EMPLOYMENT_TYPE',
  'staff-status': 'STAFF_STATUS',
  'student-status': 'STUDENT_STATUS',
  'admission-types': 'ADMISSION_TYPE',
  gender: 'GENDER',
  'nep-categories': 'NEP_CATEGORY',
  'blood-groups': 'BLOOD_GROUP',
  religion: 'RELIGION',
  'category-caste': 'CATEGORY',
  nationality: 'NATIONALITY',
  'programme-types': 'PROGRAMME_TYPE',
  'programme-modes': 'PROGRAMME_MODE',
  'board-subjects': 'BOARD_SUBJECT',
  'board-names': 'BOARD_NAME',
};
