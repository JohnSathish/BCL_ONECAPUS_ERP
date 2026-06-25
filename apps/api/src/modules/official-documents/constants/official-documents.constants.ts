export const OFFICIAL_DOCUMENT_TYPES = [
  'NOTICE',
  'CIRCULAR',
  'OFFICE_ORDER',
  'HOLIDAY',
  'MEMORANDUM',
  'EXAM',
  'STAFF',
  'STUDENT',
  'URGENT',
  'TENDER',
  'APPOINTMENT_ORDER',
  'MEETING_NOTICE',
] as const;

export type OfficialDocumentType = (typeof OFFICIAL_DOCUMENT_TYPES)[number];

export const OFFICIAL_DOCUMENT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export const OFFICIAL_DOCUMENT_PRIORITIES = [
  'NORMAL',
  'IMPORTANT',
  'URGENT',
  'EMERGENCY',
] as const;

export const OFFICIAL_AUDIT_ACTIONS = [
  'CREATE',
  'EDIT',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'PUBLISH',
  'PRINT',
  'DOWNLOAD',
  'ARCHIVE',
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  NOTICE: 'NOTICE',
  CIRCULAR: 'CIRCULAR',
  OFFICE_ORDER: 'OFFICE ORDER',
  HOLIDAY: 'HOLIDAY NOTICE',
  MEMORANDUM: 'MEMORANDUM',
  EXAM: 'EXAMINATION NOTICE',
  STAFF: 'STAFF NOTICE',
  STUDENT: 'STUDENT NOTICE',
  URGENT: 'URGENT NOTICE',
  TENDER: 'TENDER NOTICE',
  APPOINTMENT_ORDER: 'APPOINTMENT ORDER',
  MEETING_NOTICE: 'MEETING NOTICE',
};

export const DOCUMENT_TYPE_REF_CODES: Record<string, string> = {
  NOTICE: 'NOTICE',
  CIRCULAR: 'CIRCULAR',
  OFFICE_ORDER: 'OFFICE',
  HOLIDAY: 'HOLIDAY',
  MEMORANDUM: 'MEMO',
  EXAM: 'EXAM',
  STAFF: 'STAFF',
  STUDENT: 'STUDENT',
  URGENT: 'URGENT',
  TENDER: 'TENDER',
  APPOINTMENT_ORDER: 'APPOINT',
  MEETING_NOTICE: 'MEETING',
};

export function paginate(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}
