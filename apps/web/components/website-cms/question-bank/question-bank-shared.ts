import type {
  QuestionBankMaster,
  QuestionBankMasterKind,
  QuestionPaperStatus,
} from '@/types/website-cms';

export const QB_MASTER_KINDS: Array<{
  kind: QuestionBankMasterKind;
  label: string;
  singular: string;
  codeLabel?: string;
  placeholder: string;
}> = [
  {
    kind: 'ACADEMIC_YEAR',
    label: 'Academic Years',
    singular: 'academic year',
    placeholder: 'e.g. 2025 – 2026',
  },
  {
    kind: 'PROGRAMME',
    label: 'Programmes',
    singular: 'programme',
    codeLabel: 'Short code',
    placeholder: 'e.g. BA (Geography)',
  },
  {
    kind: 'DEPARTMENT',
    label: 'Departments',
    singular: 'department',
    placeholder: 'e.g. Geography',
  },
  { kind: 'MAJOR', label: 'Majors', singular: 'major', placeholder: 'e.g. Geography Major' },
  {
    kind: 'SUBJECT',
    label: 'Subjects',
    singular: 'subject',
    codeLabel: 'Subject code',
    placeholder: 'e.g. Human Geography',
  },
  {
    kind: 'EXAM_TYPE',
    label: 'Examination Types',
    singular: 'examination type',
    placeholder: 'e.g. End Semester Examination',
  },
];

export const QB_STATUS_LABELS: Record<QuestionPaperStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const QB_STATUS_CLASSES: Record<QuestionPaperStatus, string> = {
  DRAFT: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  PUBLISHED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  ARCHIVED: 'border-slate-400/40 bg-slate-400/10 text-slate-700 dark:text-slate-300',
};

export type MastersByKind = Record<QuestionBankMasterKind, QuestionBankMaster[]>;

export function groupMasters(rows: QuestionBankMaster[] | undefined): MastersByKind {
  const grouped: MastersByKind = {
    ACADEMIC_YEAR: [],
    PROGRAMME: [],
    DEPARTMENT: [],
    MAJOR: [],
    SUBJECT: [],
    EXAM_TYPE: [],
  };
  for (const row of rows ?? []) grouped[row.kind]?.push(row);
  return grouped;
}

export function formatQbDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function collegeSiteUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_COLLEGE_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://donboscocollege.ac.in';
  try {
    return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return path;
  }
}

/** Opens the tab synchronously (popup blockers) and fills it once the authenticated fetch resolves. */
export async function openPdfInNewTab(load: () => Promise<Blob>) {
  const tab = window.open('', '_blank');
  try {
    const blob = await load();
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    if (tab) tab.location.href = url;
    else window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
