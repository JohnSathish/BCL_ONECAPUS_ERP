export type StaffDocumentSlot = {
  code: string;
  label: string;
  category: string;
  supportsExpiry?: boolean;
  staffSelfUpload?: boolean;
};

export const STAFF_DOCUMENT_CATEGORIES = [
  { key: 'EMPLOYMENT', label: 'Employment Documents' },
  { key: 'EDUCATIONAL', label: 'Educational Qualifications' },
  { key: 'IDENTITY', label: 'Identity Documents' },
  { key: 'BANKING', label: 'Banking & Payroll' },
  { key: 'SERVICE', label: 'Service Records' },
  { key: 'BACKGROUND', label: 'Background Verification' },
  { key: 'RESEARCH', label: 'Research & Academic' },
  { key: 'ACCOMMODATION', label: 'Accommodation' },
  { key: 'MISC', label: 'Miscellaneous' },
] as const;

export const STAFF_DOCUMENT_SLOTS: StaffDocumentSlot[] = [
  { code: 'APPOINTMENT_ORDER', label: 'Appointment Order', category: 'EMPLOYMENT' },
  { code: 'JOINING_REPORT', label: 'Joining Report', category: 'EMPLOYMENT' },
  { code: 'CONFIRMATION_ORDER', label: 'Confirmation Order', category: 'EMPLOYMENT' },
  { code: 'PROMOTION_ORDER', label: 'Promotion Order', category: 'EMPLOYMENT' },
  { code: 'TRANSFER_ORDER', label: 'Transfer Order', category: 'EMPLOYMENT' },
  {
    code: 'CONTRACT_AGREEMENT',
    label: 'Contract Agreement',
    category: 'EMPLOYMENT',
    supportsExpiry: true,
  },
  { code: 'RESIGNATION_LETTER', label: 'Resignation Letter', category: 'EMPLOYMENT' },
  { code: 'RELIEVING_ORDER', label: 'Relieving Order', category: 'EMPLOYMENT' },
  { code: 'EXPERIENCE_CERTIFICATE', label: 'Experience Certificate', category: 'EMPLOYMENT' },
  {
    code: 'CLASS_X_CERTIFICATE',
    label: 'Class X Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'CLASS_XII_CERTIFICATE',
    label: 'Class XII Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'UG_DEGREE_CERTIFICATE',
    label: 'UG Degree Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'PG_DEGREE_CERTIFICATE',
    label: 'PG Degree Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'MPHIL_CERTIFICATE',
    label: 'M.Phil Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'PHD_CERTIFICATE',
    label: 'PhD Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'NET_CERTIFICATE',
    label: 'NET Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'SLET_CERTIFICATE',
    label: 'SLET Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'BED_CERTIFICATE',
    label: 'B.Ed Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'MED_CERTIFICATE',
    label: 'M.Ed Certificate',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  {
    code: 'OTHER_PROFESSIONAL_QUALIFICATION',
    label: 'Other Professional Qualifications',
    category: 'EDUCATIONAL',
    staffSelfUpload: true,
  },
  { code: 'AADHAAR', label: 'Aadhaar Card', category: 'IDENTITY', staffSelfUpload: true },
  { code: 'PAN', label: 'PAN Card', category: 'IDENTITY', staffSelfUpload: true },
  { code: 'VOTER_ID', label: 'Voter ID', category: 'IDENTITY', staffSelfUpload: true },
  {
    code: 'DRIVING_LICENSE',
    label: 'Driving License',
    category: 'IDENTITY',
    supportsExpiry: true,
    staffSelfUpload: true,
  },
  {
    code: 'PASSPORT',
    label: 'Passport',
    category: 'IDENTITY',
    supportsExpiry: true,
    staffSelfUpload: true,
  },
  { code: 'BANK_PASSBOOK', label: 'Bank Passbook', category: 'BANKING', staffSelfUpload: true },
  {
    code: 'CANCELLED_CHEQUE',
    label: 'Cancelled Cheque',
    category: 'BANKING',
    staffSelfUpload: true,
  },
  { code: 'PF_REGISTRATION', label: 'PF Registration', category: 'BANKING' },
  { code: 'UAN_CARD', label: 'UAN Card', category: 'BANKING', staffSelfUpload: true },
  { code: 'CPF_DOCUMENTS', label: 'CPF Documents', category: 'BANKING' },
  { code: 'PENSION_DOCUMENTS', label: 'Pension Documents', category: 'BANKING' },
  { code: 'SERVICE_BOOK', label: 'Service Book', category: 'SERVICE' },
  { code: 'INCREMENT_ORDER', label: 'Increment Orders', category: 'SERVICE' },
  { code: 'SALARY_REVISION_ORDER', label: 'Salary Revision Orders', category: 'SERVICE' },
  { code: 'LEAVE_RECORDS', label: 'Leave Records', category: 'SERVICE' },
  { code: 'DISCIPLINARY_RECORDS', label: 'Disciplinary Records', category: 'SERVICE' },
  { code: 'PERFORMANCE_APPRAISAL', label: 'Performance Appraisals', category: 'SERVICE' },
  {
    code: 'POLICE_VERIFICATION',
    label: 'Police Verification',
    category: 'BACKGROUND',
    supportsExpiry: true,
  },
  { code: 'CHARACTER_CERTIFICATE', label: 'Character Certificate', category: 'BACKGROUND' },
  {
    code: 'MEDICAL_FITNESS_CERTIFICATE',
    label: 'Medical Fitness Certificate',
    category: 'BACKGROUND',
    supportsExpiry: true,
  },
  { code: 'PUBLICATION', label: 'Publications', category: 'RESEARCH', staffSelfUpload: true },
  { code: 'RESEARCH_PAPER', label: 'Research Papers', category: 'RESEARCH', staffSelfUpload: true },
  {
    code: 'CONFERENCE_CERTIFICATE',
    label: 'Conference Certificates',
    category: 'RESEARCH',
    staffSelfUpload: true,
  },
  {
    code: 'FDP_CERTIFICATE',
    label: 'FDP Certificates',
    category: 'RESEARCH',
    staffSelfUpload: true,
  },
  {
    code: 'WORKSHOP_CERTIFICATE',
    label: 'Workshop Certificates',
    category: 'RESEARCH',
    staffSelfUpload: true,
  },
  {
    code: 'ORIENTATION_PROGRAMME',
    label: 'Orientation Programme',
    category: 'RESEARCH',
    staffSelfUpload: true,
  },
  {
    code: 'REFRESHER_COURSE',
    label: 'Refresher Course',
    category: 'RESEARCH',
    staffSelfUpload: true,
  },
  {
    code: 'QUARTER_ALLOCATION_ORDER',
    label: 'Quarter Allocation Order',
    category: 'ACCOMMODATION',
  },
  { code: 'QUARTER_SURRENDER_ORDER', label: 'Quarter Surrender Order', category: 'ACCOMMODATION' },
  { code: 'RENT_DEDUCTION_APPROVAL', label: 'Rent Deduction Approval', category: 'ACCOMMODATION' },
  {
    code: 'PASSPORT_SIZE_PHOTO',
    label: 'Passport Size Photo',
    category: 'MISC',
    staffSelfUpload: true,
  },
  { code: 'SIGNATURE', label: 'Signature', category: 'MISC', staffSelfUpload: true },
  { code: 'NOMINATION_FORM', label: 'Nomination Form', category: 'MISC', staffSelfUpload: true },
  {
    code: 'EMERGENCY_CONTACT_FORM',
    label: 'Emergency Contact Form',
    category: 'MISC',
    staffSelfUpload: true,
  },
  { code: 'OTHER', label: 'Any Other Document', category: 'MISC', staffSelfUpload: true },
];

export const STAFF_SELF_UPLOAD_DOC_TYPES = STAFF_DOCUMENT_SLOTS.filter(
  (s) => s.staffSelfUpload,
).map((s) => s.code);

export function staffDocumentLabel(code: string) {
  return STAFF_DOCUMENT_SLOTS.find((s) => s.code === code)?.label ?? code.replace(/_/g, ' ');
}

export function slotSupportsExpiry(code: string) {
  return STAFF_DOCUMENT_SLOTS.find((s) => s.code === code)?.supportsExpiry ?? false;
}
