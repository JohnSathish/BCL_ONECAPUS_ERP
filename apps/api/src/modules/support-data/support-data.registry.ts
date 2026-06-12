import { DEPARTMENT_TYPES } from '../organization/dto/organization.dto';
import type { SupportDataCategoryDef } from './support-data.types';

const DEPARTMENT_TYPE_LABELS: Record<string, string> = {
  ACADEMIC: 'Academic — General',
  ARTS: 'Academic — Arts',
  SCIENCE: 'Academic — Science',
  COMMERCE: 'Academic — Commerce',
  PROFESSIONAL: 'Academic — Professional',
  INTERDISCIPLINARY: 'Academic — Interdisciplinary',
  ADMINISTRATIVE: 'Administrative',
};

const DEPARTMENT_TYPE_OPTIONS = DEPARTMENT_TYPES.map((v) => ({
  value: v,
  label: DEPARTMENT_TYPE_LABELS[v] ?? v.replace(/_/g, ' '),
}));

const DESIGNATION_CATEGORIES = [
  { value: 'TEACHING', label: 'Teaching' },
  { value: 'NON_TEACHING', label: 'Non Teaching' },
  { value: 'ADMIN', label: 'Administrative' },
];

const BOARD_SUBJECT_CATEGORIES = [
  { value: 'SCIENCE', label: 'Science' },
  { value: 'ARTS', label: 'Arts' },
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'LANGUAGE', label: 'Language' },
  { value: 'VOCATIONAL', label: 'Vocational' },
  { value: 'GENERAL', label: 'General' },
];

const BOARD_TYPES = [
  { value: 'CBSE', label: 'CBSE' },
  { value: 'MBOSE', label: 'MBOSE' },
  { value: 'ISC', label: 'ISC' },
  { value: 'STATE', label: 'State' },
  { value: 'GENERAL', label: 'General' },
];

const LOOKUP_FIELDS = [
  { key: 'code', label: 'Code', type: 'code' as const, required: true },
  { key: 'label', label: 'Label', type: 'text' as const, required: true },
  { key: 'sortOrder', label: 'Sort order', type: 'number' as const },
  { key: 'color', label: 'Color tag', type: 'color' as const },
  { key: 'icon', label: 'Icon', type: 'icon' as const },
];

function lookupCategory(
  code: string,
  label: string,
  group: string,
  lookupType: string,
  opts?: Partial<SupportDataCategoryDef['features']>,
): SupportDataCategoryDef {
  return {
    code,
    label,
    group,
    source: 'lookup',
    lookupType,
    permissions: ['lookups:read', 'lookups:manage'],
    fields: LOOKUP_FIELDS,
    features: {
      search: true,
      reorder: true,
      import: true,
      export: true,
      campusScope: false,
      ...opts,
    },
  };
}

export const SUPPORT_DATA_CATEGORIES: SupportDataCategoryDef[] = [
  {
    code: 'departments',
    label: 'Departments',
    group: 'academic',
    source: 'dedicated',
    permissions: ['lookups:manage', 'org:manage'],
    fields: [
      { key: 'code', label: 'Code', type: 'code', required: true },
      { key: 'label', label: 'Name', type: 'text', required: true },
      {
        key: 'departmentType',
        label: 'Type',
        type: 'select',
        required: true,
        options: DEPARTMENT_TYPE_OPTIONS,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
    ],
    features: {
      search: true,
      reorder: false,
      import: true,
      export: true,
      campusScope: true,
    },
  },
  {
    code: 'designations',
    label: 'Designations',
    group: 'academic',
    source: 'dedicated',
    permissions: ['lookups:manage', 'staff:manage'],
    fields: [
      { key: 'code', label: 'Code', type: 'code', required: true },
      { key: 'label', label: 'Name', type: 'text', required: true },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: DESIGNATION_CATEGORIES,
      },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
    ],
    features: {
      search: true,
      reorder: true,
      import: true,
      export: true,
      campusScope: false,
    },
  },
  {
    code: 'additional-roles',
    label: 'Additional Roles',
    group: 'academic',
    source: 'dedicated',
    permissions: ['lookups:manage', 'staff:manage'],
    fields: [
      { key: 'code', label: 'Code', type: 'code', required: true },
      { key: 'label', label: 'Name', type: 'text', required: true },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
    ],
    features: {
      search: true,
      reorder: true,
      import: true,
      export: true,
      campusScope: false,
    },
  },
  {
    code: 'shifts',
    label: 'Shifts',
    group: 'academic',
    source: 'dedicated',
    permissions: ['lookups:manage', 'org:manage'],
    fields: [
      { key: 'code', label: 'Code', type: 'code', required: true },
      { key: 'label', label: 'Name', type: 'text', required: true },
      { key: 'startTime', label: 'Start time', type: 'time', required: true },
      { key: 'endTime', label: 'End time', type: 'time', required: true },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
    ],
    features: {
      search: true,
      reorder: true,
      import: false,
      export: true,
      campusScope: true,
    },
  },
  {
    code: 'board-subjects',
    label: 'Board Subjects',
    group: 'academic',
    source: 'dedicated',
    permissions: ['lookups:manage', 'students:manage'],
    fields: [
      {
        key: 'subjectName',
        label: 'Subject Name',
        type: 'text',
        required: true,
      },
      {
        key: 'subjectCode',
        label: 'Subject Code',
        type: 'code',
        required: true,
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: BOARD_SUBJECT_CATEGORIES,
      },
      {
        key: 'boardType',
        label: 'Board Type',
        type: 'select',
        options: BOARD_TYPES,
      },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
    ],
    features: {
      search: true,
      reorder: true,
      import: true,
      export: true,
      campusScope: false,
    },
  },
  lookupCategory(
    'programme-types',
    'Programme Types',
    'academic',
    'PROGRAMME_TYPE',
  ),
  lookupCategory(
    'programme-modes',
    'Programme Modes',
    'academic',
    'PROGRAMME_MODE',
  ),
  lookupCategory('semesters', 'Semesters', 'academic', 'SEMESTER'),
  lookupCategory(
    'academic-status',
    'Academic Status',
    'academic',
    'ACADEMIC_STATUS',
  ),
  lookupCategory(
    'admission-types',
    'Admission Types',
    'academic',
    'ADMISSION_TYPE',
  ),
  lookupCategory(
    'nep-categories',
    'NEP Categories',
    'academic',
    'NEP_CATEGORY',
  ),
  lookupCategory('staff-types', 'Staff Types', 'staff', 'STAFF_TYPE'),
  lookupCategory(
    'employment-types',
    'Employment Types',
    'staff',
    'EMPLOYMENT_TYPE',
  ),
  lookupCategory('staff-status', 'Staff Status', 'staff', 'STAFF_STATUS'),
  lookupCategory(
    'qualification-types',
    'Qualification Types',
    'staff',
    'QUALIFICATION_TYPE',
  ),
  lookupCategory('blood-groups', 'Blood Groups', 'students', 'BLOOD_GROUP'),
  lookupCategory('religion', 'Religion', 'students', 'RELIGION'),
  lookupCategory('category-caste', 'Category / Caste', 'students', 'CATEGORY'),
  lookupCategory('nationality', 'Nationality', 'students', 'NATIONALITY'),
  lookupCategory('mother-tongue', 'Mother Tongue', 'students', 'MOTHER_TONGUE'),
  lookupCategory('occupation', 'Occupation', 'students', 'OCCUPATION'),
  lookupCategory('board-names', 'Board Names', 'students', 'BOARD_NAME'),
  lookupCategory(
    'disability-types',
    'Disability Types',
    'students',
    'DISABILITY_TYPE',
  ),
  lookupCategory(
    'student-status',
    'Student Status',
    'students',
    'STUDENT_STATUS',
  ),
  lookupCategory('gender', 'Gender', 'students', 'GENDER'),
  lookupCategory('tribe', 'Tribe', 'students', 'TRIBE'),
  lookupCategory('language', 'Language', 'students', 'LANGUAGE'),
  lookupCategory('denomination', 'Denomination', 'students', 'DENOMINATION'),
];

export const SUPPORT_DATA_GROUPS = [
  { code: 'academic', label: 'Academic' },
  { code: 'staff', label: 'Staff' },
  { code: 'students', label: 'Students' },
];

export function getCategoryDef(
  code: string,
): SupportDataCategoryDef | undefined {
  return SUPPORT_DATA_CATEGORIES.find((c) => c.code === code);
}

export function listCategories(group?: string) {
  const cats = group
    ? SUPPORT_DATA_CATEGORIES.filter((c) => c.group === group)
    : SUPPORT_DATA_CATEGORIES;
  return SUPPORT_DATA_GROUPS.map((g) => ({
    ...g,
    categories: cats
      .filter((c) => c.group === g.code)
      .map((c) => ({
        code: c.code,
        label: c.label,
        source: c.source,
        lookupType: c.lookupType,
        features: c.features,
        fields: c.fields,
      })),
  })).filter((g) => g.categories.length > 0);
}
