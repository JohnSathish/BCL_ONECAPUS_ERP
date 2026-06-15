export type NaacEvidenceTagFormValues = {
  criterion: number;
  academicYear: string;
  metricCode: string;
  departmentId: string;
  committeeId: string;
  programmeId: string;
  activityTitle: string;
  eventTitle: string;
  evidenceNotes: string;
};

export const NAAC_CRITERIA_OPTIONS = [
  { value: 1, label: '1 — Curricular Aspects' },
  { value: 2, label: '2 — Teaching-Learning & Evaluation' },
  { value: 3, label: '3 — Research, Innovations & Extension' },
  { value: 4, label: '4 — Infrastructure & Learning Resources' },
  { value: 5, label: '5 — Student Support & Progression' },
  { value: 6, label: '6 — Governance, Leadership & Management' },
  { value: 7, label: '7 — Institutional Values & Best Practices' },
] as const;

export function buildNaacEvidenceTagFormData(
  file: File,
  values: NaacEvidenceTagFormValues,
): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('criterion', String(values.criterion));
  form.append('academicYear', values.academicYear.trim());
  if (values.metricCode) form.append('metricCode', values.metricCode);
  if (values.departmentId) form.append('departmentId', values.departmentId);
  if (values.committeeId) form.append('committeeId', values.committeeId);
  if (values.programmeId) form.append('programmeId', values.programmeId);
  if (values.activityTitle.trim()) form.append('activityTitle', values.activityTitle.trim());
  if (values.eventTitle.trim()) form.append('eventTitle', values.eventTitle.trim());
  if (values.evidenceNotes.trim()) form.append('evidenceNotes', values.evidenceNotes.trim());
  return form;
}
