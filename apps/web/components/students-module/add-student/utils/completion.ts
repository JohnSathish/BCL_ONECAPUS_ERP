import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';

const WEIGHTS: { key: string; weight: number; check: (d: AddStudentDraft) => boolean }[] = [
  { key: 'basic', weight: 20, check: (d) => d.fullName.length >= 2 && d.email.includes('@') },
  {
    key: 'academic',
    weight: 20,
    check: (d) =>
      Boolean(
        d.programVersionId &&
        d.admissionBatchId &&
        d.primaryShiftId &&
        d.boardName &&
        d.class12Subjects.length > 0,
      ),
  },
  { key: 'fyugp', weight: 15, check: (d) => Object.keys(d.subjectSelections).length > 0 },
  { key: 'guardians', weight: 10, check: (d) => Boolean(d.father.fullName || d.mother.fullName) },
  { key: 'address', weight: 10, check: (d) => Boolean(d.tura.line1 || d.home.line1) },
  {
    key: 'reservation',
    weight: 5,
    check: (d) => Boolean(d.categoryLookupId || d.religionLookupId),
  },
  {
    key: 'board',
    weight: 10,
    check: (d) => Boolean(d.cuetApplied || d.subjectMarks.some((m) => m.subjectName.trim())),
  },
  { key: 'documents', weight: 5, check: (d) => d.pendingDocuments.length > 0 },
  { key: 'review', weight: 5, check: () => true },
];

export function computeProfileCompletion(draft: AddStudentDraft): number {
  const total = WEIGHTS.reduce((s, w) => s + w.weight, 0);
  const earned = WEIGHTS.reduce((s, w) => s + (w.check(draft) ? w.weight : 0), 0);
  return Math.round((earned / total) * 100);
}
