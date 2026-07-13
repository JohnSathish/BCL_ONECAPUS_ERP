/**
 * Per-audience UI registry for the Communication Center audience panel.
 * Backend still accepts legacy types (TEACHING_STAFF, etc.) for saved segments.
 */

export type AudienceFilterSection =
  | 'shift'
  | 'department'
  | 'semester'
  | 'admissionBatch'
  | 'gender'
  | 'hostel'
  | 'feeStatus'
  | 'attendance'
  | 'rollRange'
  | 'studentSearch'
  | 'staffRolePresets'
  | 'designation'
  | 'employmentStatus'
  | 'staffSearch'
  | 'committee'
  | 'userSearch';

export type AudiencePanelConfig = {
  value: string;
  label: string;
  subtitle: string;
  showAcademicBanner: boolean;
  essentials: AudienceFilterSection[];
  more: AudienceFilterSection[];
  countLabel: string;
};

export const AUDIENCE_PANEL_CONFIG: Record<string, AudiencePanelConfig> = {
  STUDENTS: {
    value: 'STUDENTS',
    label: 'Students',
    subtitle: 'Shift · Department · Current semester',
    showAcademicBanner: true,
    essentials: ['shift', 'department', 'semester'],
    more: [
      'admissionBatch',
      'gender',
      'hostel',
      'feeStatus',
      'attendance',
      'rollRange',
      'studentSearch',
    ],
    countLabel: 'Students',
  },
  FACULTY: {
    value: 'FACULTY',
    label: 'Staff',
    subtitle: 'Role · Department · Designation · Employment',
    showAcademicBanner: false,
    essentials: ['staffRolePresets', 'department', 'designation', 'employmentStatus'],
    more: ['staffSearch', 'gender'],
    countLabel: 'Staff',
  },
  PARENTS: {
    value: 'PARENTS',
    label: 'Parents',
    subtitle: 'Linked to student Shift · Semester · Department · Batch',
    showAcademicBanner: true,
    essentials: ['shift', 'department', 'semester', 'admissionBatch'],
    more: ['gender', 'hostel', 'studentSearch'],
    countLabel: 'Parents',
  },
  ALUMNI: {
    value: 'ALUMNI',
    label: 'Alumni',
    subtitle: 'Admission batch · Department · Programme cohort',
    showAcademicBanner: true,
    essentials: ['admissionBatch', 'department'],
    more: ['gender', 'studentSearch'],
    countLabel: 'Alumni',
  },
  COMMITTEE: {
    value: 'COMMITTEE',
    label: 'Committee',
    subtitle: 'Select one or more governance committees',
    showAcademicBanner: false,
    essentials: ['committee'],
    more: [],
    countLabel: 'Members',
  },
  DEPARTMENTS: {
    value: 'DEPARTMENTS',
    label: 'Departments',
    subtitle: 'Students and staff in selected departments',
    showAcademicBanner: false,
    essentials: ['department'],
    more: [],
    countLabel: 'Recipients',
  },
  INDIVIDUAL: {
    value: 'INDIVIDUAL',
    label: 'Individual',
    subtitle: 'Search and include specific people',
    showAcademicBanner: false,
    essentials: ['userSearch', 'staffSearch', 'studentSearch'],
    more: [],
    countLabel: 'Individuals',
  },
};

export function getAudiencePanelConfig(audienceType: string): AudiencePanelConfig {
  return (
    AUDIENCE_PANEL_CONFIG[audienceType] ?? {
      value: audienceType,
      label: audienceType,
      subtitle: 'Audience filters',
      showAcademicBanner: false,
      essentials: ['department'],
      more: [],
      countLabel: 'Recipients',
    }
  );
}

/** Fields that only apply to student-linked audiences. */
export const STUDENT_ONLY_FILTER_KEYS = [
  'semesterSequences',
  'admissionBatchIds',
  'batchIds',
  'shiftIds',
  'studentIds',
  'excludeStudentIds',
  'studentStatus',
  'admissionCategory',
  'residenceType',
  'hosteller',
  'dayScholar',
  'attendanceBelowPct',
  'attendanceAbovePct',
  'feeDue',
  'defaulters',
  'feeStatus',
  'rollNumberFrom',
  'rollNumberTo',
  'programVersionIds',
  'sectionIds',
] as const;

/** Fields that only apply to staff audiences. */
export const STAFF_ONLY_FILTER_KEYS = [
  'staffProfileIds',
  'designationIds',
  'teaching',
  'nonTeaching',
  'permanent',
  'contract',
  'staffStatuses',
] as const;

/** Fields that only apply to committee audiences. */
export const COMMITTEE_ONLY_FILTER_KEYS = ['committeeIds'] as const;

/** Fields that only apply to individual user targeting. */
export const INDIVIDUAL_ONLY_FILTER_KEYS = ['userIds'] as const;
