export const LMS_WORKSPACE_TYPES = ['SECTION', 'POOL'] as const;
export type LmsWorkspaceType = (typeof LMS_WORKSPACE_TYPES)[number];

export const LMS_MATERIAL_CATEGORIES = [
  'LECTURE_NOTES',
  'REFERENCE',
  'QUESTION_BANK',
  'LAB_MANUAL',
  'ASSIGNMENT',
  'PREVIOUS_PAPERS',
  'MODEL_ANSWERS',
  'RESEARCH',
  'EBOOK',
  'SYLLABUS',
  'OTHER',
] as const;

export const LMS_MATERIAL_VISIBILITY = [
  'ENROLLED',
  'FACULTY_ONLY',
  'PUBLIC_LINK',
] as const;
export const LMS_MATERIAL_STATUS = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const LMS_LESSON_PLAN_STATUS = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;
export const LMS_ANNOUNCEMENT_TYPES = [
  'NOTICE',
  'ASSIGNMENT',
  'EXAM',
  'CLASS_CHANGE',
  'MATERIAL',
] as const;

export const LMS_ASSIGNMENT_STATUS = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const;
export const LMS_ASSIGNMENT_SUBMISSION_TYPES = [
  'FILE',
  'TEXT',
  'LINK',
  'MIXED',
] as const;
export const LMS_SUBMISSION_STATUS = [
  'SUBMITTED',
  'RETURNED',
  'EVALUATED',
] as const;
export const LMS_FEEDBACK_ACTIONS = ['EVALUATE', 'RETURN'] as const;

export const LMS_DEFAULT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'audio/mpeg',
  'text/plain',
];

export const ENROLLED_LINE_STATUSES = [
  'approved',
  'confirmed',
  'registered',
  'pending',
];
