/** Human-readable labels for admission form validation summaries. */
export const ADMISSION_FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  email: 'Email',
  enrollmentNumber: 'NEHU Registration Number',
  nehuRollNumber: 'NEHU Roll Number',
  mobileNumber: 'Mobile Number',
  nationalId: 'Aadhaar / National ID',
  dateOfBirth: 'Date of Birth',
  rollNumber: 'Roll Number',
  abcId: 'ABC ID',
  programVersionId: 'Programme',
  admissionBatchId: 'Admission Batch',
  streamId: 'Stream',
  primaryShiftId: 'Shift',
  majorSubjectSlug: 'Major Subject',
  minorSubjectSlug: 'Minor Subject',
  boardName: 'Board Name',
  schoolName: 'School Name',
  examYear: 'Passing Year',
  boardStream: 'Class XII Stream',
  class12Subjects: 'Class XII Subjects',
  overallMarks: 'Overall Marks / Percentage',
  subjectSelections: 'Subject Selections',
  credits: 'Semester Credits',
  eligibility: 'Eligibility',
  form: 'Form',
};

export function admissionFieldLabel(fieldKey: string): string {
  return ADMISSION_FIELD_LABELS[fieldKey] ?? fieldKey.replace(/([A-Z])/g, ' $1').trim();
}
