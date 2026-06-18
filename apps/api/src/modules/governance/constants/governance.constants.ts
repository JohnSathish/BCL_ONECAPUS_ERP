export const GOVERNANCE_COMMITTEE_TYPES = [
  'STANDING',
  'AD_HOC',
  'STATUTORY',
  'SUB_COMMITTEE',
] as const;

export const GOVERNANCE_COMMITTEE_CATEGORIES = [
  'ACADEMIC',
  'ADMINISTRATIVE',
  'STATUTORY',
  'QUALITY',
  'STUDENT_WELFARE',
  'RESEARCH',
  'EXAMINATION',
  'ADMISSION',
  'CO_CURRICULAR',
  'INFRASTRUCTURE',
  'FINANCE',
  'OTHER',
] as const;

export const GOVERNANCE_COMMITTEE_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DISSOLVED',
] as const;

export const GOVERNANCE_MEMBER_TYPES = [
  'INTERNAL_STAFF',
  'EXTERNAL',
  'EX_OFFICIO',
  'STUDENT_REPRESENTATIVE',
  'ALUMNI_REPRESENTATIVE',
  'PARENT_REPRESENTATIVE',
  'INDUSTRY_EXPERT',
] as const;

export const GOVERNANCE_EX_OFFICIO_POSITIONS = [
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'IQAC_COORDINATOR',
  'DEAN',
  'DEAN_ACADEMICS',
  'REGISTRAR',
  'CONTROLLER_OF_EXAMINATIONS',
  'BURSAR',
] as const;

export const GOVERNANCE_EX_OFFICIO_DESIGNATION_CODES: Record<
  (typeof GOVERNANCE_EX_OFFICIO_POSITIONS)[number],
  string[]
> = {
  PRINCIPAL: ['PRINCIPAL'],
  VICE_PRINCIPAL: ['VICE_PRINCIPAL'],
  IQAC_COORDINATOR: ['IQAC_COORDINATOR', 'IQAC COORDINATOR'],
  DEAN: ['DEAN'],
  DEAN_ACADEMICS: ['DEAN_ACADEMICS', 'DEAN OF ACADEMICS'],
  REGISTRAR: ['REGISTRAR'],
  CONTROLLER_OF_EXAMINATIONS: [
    'CONTROLLER_OF_EXAMINATIONS',
    'CONTROLLER OF EXAMINATIONS',
    'COE',
  ],
  BURSAR: ['BURSAR'],
};

export const GOVERNANCE_MEMBER_ROLES = [
  'CHAIRPERSON',
  'CONVENER',
  'SECRETARY',
  'MEMBER',
  'MEMBER_SECRETARY',
  'COORDINATOR',
  'EX_OFFICIO',
  'STUDENT_REPRESENTATIVE',
  'EXTERNAL_EXPERT',
  'PARENT_REPRESENTATIVE',
  'ALUMNI_REPRESENTATIVE',
  'INDUSTRY_EXPERT',
  'LEGAL_EXPERT',
  'SPECIAL_INVITEE',
  'OBSERVER',
] as const;

export const GOVERNANCE_MEMBER_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'RESIGNED',
  'REPLACED',
] as const;

export const GOVERNANCE_MEETING_MODES = [
  'PHYSICAL',
  'ONLINE',
  'HYBRID',
] as const;

export const GOVERNANCE_MEETING_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'POSTPONED',
] as const;

export const GOVERNANCE_MEETING_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
] as const;

export const GOVERNANCE_ATTENDANCE_METHODS = [
  'MANUAL',
  'QR',
  'OTP',
  'SELF',
] as const;

export const GOVERNANCE_ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
] as const;

export const GOVERNANCE_MOM_STATUSES = [
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
] as const;

export const GOVERNANCE_ATR_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'DEFERRED',
  'CANCELLED',
] as const;

export const GOVERNANCE_TASK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export const GOVERNANCE_NOTICE_AUDIENCES = [
  'COMMITTEE',
  'STAFF',
  'STUDENTS',
  'ALL',
  'PUBLIC',
] as const;

export const GOVERNANCE_NOTICE_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export const GOVERNANCE_DOCUMENT_CATEGORIES = [
  'MINUTES',
  'AGENDA',
  'CIRCULAR',
  'POLICY',
  'REPORT',
  'EVIDENCE',
  'CORRESPONDENCE',
  'OTHER',
] as const;

export const GOVERNANCE_EVENT_TYPES = [
  'MEETING',
  'WORKSHOP',
  'SEMINAR',
  'TRAINING',
  'AWARENESS',
  'AUDIT',
  'OTHER',
] as const;

export const GOVERNANCE_EVENT_STATUSES = [
  'PLANNED',
  'ONGOING',
  'COMPLETED',
  'CANCELLED',
] as const;

export const GOVERNANCE_NAAC_CRITERIA = [
  { criterion: 1, title: 'Curricular Aspects' },
  { criterion: 2, title: 'Teaching-Learning and Evaluation' },
  { criterion: 3, title: 'Research, Innovations and Extension' },
  { criterion: 4, title: 'Infrastructure and Learning Resources' },
  { criterion: 5, title: 'Student Support and Progression' },
  { criterion: 6, title: 'Governance, Leadership and Management' },
  { criterion: 7, title: 'Institutional Values and Best Practices' },
] as const;

export const DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS = {
  meetingFrequency: 0.2,
  attendanceRate: 0.25,
  atrCompletion: 0.25,
  taskCompletion: 0.15,
  documentation: 0.15,
} as const;

export const GOVERNANCE_IMPORT_STATUSES = [
  'PENDING',
  'PARSED',
  'REVIEW',
  'COMMITTED',
  'FAILED',
] as const;

export const GOVERNANCE_IMPORT_DRAFT_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMMITTED',
] as const;

export const GOVERNANCE_REPORT_TYPES = [
  'committee-summary',
  'meeting-register',
  'attendance-summary',
  'atr-register',
  'task-register',
  'naac-evidence',
  'performance-scorecard',
] as const;

export const GOVERNANCE_REPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;

/** NAAC composition rules keyed by committee short code (uppercase). */
export const GOVERNANCE_NAAC_COMPOSITION_RULES: Record<
  string,
  {
    label: string;
    minMembers: number;
    requireExternal: boolean;
    requireFemalePresiding: boolean;
    requiredRoles: string[];
  }
> = {
  ICC: {
    label: 'Internal Complaints Committee (ICC / POSH)',
    minMembers: 5,
    requireExternal: true,
    requireFemalePresiding: true,
    requiredRoles: ['CHAIRPERSON', 'COORDINATOR'],
  },
  POSH: {
    label: 'POSH Committee',
    minMembers: 5,
    requireExternal: true,
    requireFemalePresiding: true,
    requiredRoles: ['CHAIRPERSON', 'COORDINATOR'],
  },
  IQAC: {
    label: 'Internal Quality Assurance Cell',
    minMembers: 5,
    requireExternal: false,
    requireFemalePresiding: false,
    requiredRoles: ['COORDINATOR'],
  },
  ANTI_RAGGING: {
    label: 'Anti-Ragging Committee',
    minMembers: 7,
    requireExternal: true,
    requireFemalePresiding: false,
    requiredRoles: ['CHAIRPERSON'],
  },
};

export function paginate(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}

export function academicYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = month >= 5 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}
