import {
  buildBulkCr80PrintHtmlDocument,
  buildCr80PrintDocument,
} from '@/components/id-cards/build-cr80-print-html';
import { buildStudentIdCardModelFromProfile } from '@/components/id-cards/build-student-id-card-model-from-profile';
import { enhanceStudentCardModel } from '@/components/id-cards/enhance-student-card-model';
import { normalizeIdCardLayout } from '@/components/id-cards/layout-legacy-migrate';
import type { IdCardIssue, IdCardSettings } from '@/services/id-cards';
import { fetchAllStudentIdCardIssues, renderIdCardPdf } from '@/services/id-cards';
import { fetchAllStudents, fetchStudentProfile } from '@/services/students';
import type { InstitutionBranding } from '@/types/branding';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { StudentDirectoryRow, StudentProfile } from '@/types/students';

export const MAX_STUDENT_BULK_PDF = 150;

const ACTIVE_ISSUE_STATUSES = ['GENERATED', 'PRINTED', 'ASSIGNED'] as const;

export type StudentBulkPdfExportFilters = {
  departmentId?: string;
  semester?: string;
  sessionId?: string;
  academicStatus?: string;
};

export type StudentBulkPdfExportProgress = {
  phase: 'loading' | 'profiles' | 'building' | 'rendering';
  done: number;
  total: number;
};

function indexLatestStudentIssues(issues: IdCardIssue[]): Map<string, IdCardIssue> {
  const map = new Map<string, IdCardIssue>();
  for (const issue of issues) {
    if (!issue.studentId) continue;
    if (!ACTIVE_ISSUE_STATUSES.includes(issue.status as (typeof ACTIVE_ISSUE_STATUSES)[number]))
      continue;
    if (!map.has(issue.studentId)) map.set(issue.studentId, issue);
  }
  return map;
}

function sortStudentsByName(rows: StudentDirectoryRow[]): StudentDirectoryRow[] {
  return [...rows].sort((a, b) =>
    (a.displayFullName ?? a.fullName).localeCompare(b.displayFullName ?? b.fullName, undefined, {
      sensitivity: 'base',
    }),
  );
}

async function fetchStudentProfilesBatch(ids: string[]): Promise<Map<string, StudentProfile>> {
  const map = new Map<string, StudentProfile>();
  const chunkSize = 8;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const profiles = await Promise.all(chunk.map((id) => fetchStudentProfile(id)));
    for (const profile of profiles) {
      map.set(profile.id, profile);
    }
  }
  return map;
}

export async function exportStudentIdCardsBulkPdf(options: {
  layout: IdCardLayoutV1;
  branding?: InstitutionBranding | null;
  settings?: IdCardSettings | null;
  signatureUrl?: string | null;
  filters?: StudentBulkPdfExportFilters;
  onProgress?: (progress: StudentBulkPdfExportProgress) => void;
}): Promise<{ blob: Blob; exported: number; skipped: number; capped: boolean }> {
  const { layout, branding, settings, signatureUrl, filters, onProgress } = options;
  const normalizedLayout = normalizeIdCardLayout(layout, 'STUDENT');

  onProgress?.({ phase: 'loading', done: 0, total: 0 });

  const [studentsRes, issues] = await Promise.all([
    fetchAllStudents({
      departmentId: filters?.departmentId,
      semester: filters?.semester,
      sessionId: filters?.sessionId,
      academicStatus: filters?.academicStatus || 'ACTIVE',
    }),
    fetchAllStudentIdCardIssues({
      departmentId: filters?.departmentId,
    }),
  ]);

  const issuesByStudentId = indexLatestStudentIssues(issues);
  let eligible = studentsRes.data.filter((row) => issuesByStudentId.has(row.id));
  if (filters?.semester) {
    const sem = Number(filters.semester);
    if (!Number.isNaN(sem)) {
      eligible = eligible.filter((row) => row.semester === sem);
    }
  }

  const withCards = sortStudentsByName(eligible);
  const skipped = studentsRes.data.length - withCards.length;

  if (withCards.length === 0) {
    throw new Error(
      'No students with generated card records match your filters. Run bulk generate first.',
    );
  }

  const capped = withCards.length > MAX_STUDENT_BULK_PDF;
  const exportRows = withCards.slice(0, MAX_STUDENT_BULK_PDF);

  onProgress?.({ phase: 'profiles', done: 0, total: exportRows.length });
  const profilesById = await fetchStudentProfilesBatch(exportRows.map((row) => row.id));
  onProgress?.({ phase: 'profiles', done: exportRows.length, total: exportRows.length });

  const pages: string[] = [];
  onProgress?.({ phase: 'building', done: 0, total: exportRows.length });

  for (let i = 0; i < exportRows.length; i += 1) {
    const row = exportRows[i]!;
    const profile = profilesById.get(row.id) ?? (row as StudentProfile);
    const issue = issuesByStudentId.get(row.id);
    const base = buildStudentIdCardModelFromProfile({
      profile,
      branding: branding ?? undefined,
    });
    const model = enhanceStudentCardModel(base, {
      activeIssue: issue,
      settings: settings ?? null,
    });
    const { frontHtml, backHtml } = buildCr80PrintDocument({
      model,
      layout: normalizedLayout,
      holderType: 'STUDENT',
      purpose: 'preview',
      signatureUrl,
    });
    pages.push(frontHtml, backHtml);
    onProgress?.({ phase: 'building', done: i + 1, total: exportRows.length });
  }

  const html = buildBulkCr80PrintHtmlDocument(pages);
  const pageCount = pages.length;

  onProgress?.({ phase: 'rendering', done: 0, total: pageCount });

  const blob = await renderIdCardPdf(html, {
    pageCount,
    timeoutMs: Math.min(600_000, 90_000 + pageCount * 2_000),
  });

  return { blob, exported: exportRows.length, skipped, capped };
}

export function studentBulkPdfFilename(options?: {
  departmentName?: string;
  semester?: string;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const deptSlug = options?.departmentName
    ? options.departmentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32)
    : 'all-students';
  const semSlug = options?.semester ? `-sem-${options.semester}` : '';
  return `student-id-cards-${deptSlug}${semSlug}-${date}.pdf`;
}
