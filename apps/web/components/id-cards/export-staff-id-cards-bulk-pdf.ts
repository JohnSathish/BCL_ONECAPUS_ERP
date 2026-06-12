import {
  buildBulkCr80PrintHtmlDocument,
  buildCr80PrintDocument,
} from '@/components/id-cards/build-cr80-print-html';
import {
  buildStaffIdCardModelFromProfile,
  staffHolderTypeForGenerate,
} from '@/components/id-cards/build-staff-id-card-model-from-profile';
import { enhanceStaffCardModel } from '@/components/id-cards/enhance-staff-card-model';
import { normalizeIdCardLayout } from '@/components/id-cards/layout-legacy-migrate';
import type { IdCardIssue, IdCardSettings } from '@/services/id-cards';
import { fetchAllStaffIdCardIssues, renderIdCardPdf } from '@/services/id-cards';
import { fetchAllStaff } from '@/services/staff';
import type { InstitutionBranding } from '@/types/branding';
import type { IdCardLayoutV1 } from '@/types/id-card-template';
import type { StaffListItem, StaffProfile } from '@/types/staff';

export const MAX_STAFF_BULK_PDF = 150;

const ACTIVE_ISSUE_STATUSES = ['GENERATED', 'PRINTED', 'ASSIGNED'] as const;

export type StaffBulkPdfExportFilters = {
  departmentId?: string;
  staffType?: string;
  designationId?: string;
  status?: string;
};

export type StaffBulkPdfExportProgress = {
  phase: 'loading' | 'building' | 'rendering';
  done: number;
  total: number;
};

function indexLatestStaffIssues(issues: IdCardIssue[]): Map<string, IdCardIssue> {
  const map = new Map<string, IdCardIssue>();
  for (const issue of issues) {
    if (!issue.staffProfileId) continue;
    if (!ACTIVE_ISSUE_STATUSES.includes(issue.status as (typeof ACTIVE_ISSUE_STATUSES)[number]))
      continue;
    if (!map.has(issue.staffProfileId)) map.set(issue.staffProfileId, issue);
  }
  return map;
}

function sortStaffByName(rows: StaffListItem[]): StaffListItem[] {
  return [...rows].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }),
  );
}

export async function exportStaffIdCardsBulkPdf(options: {
  layout: IdCardLayoutV1;
  branding?: InstitutionBranding | null;
  settings?: IdCardSettings | null;
  signatureUrl?: string | null;
  filters?: StaffBulkPdfExportFilters;
  onProgress?: (progress: StaffBulkPdfExportProgress) => void;
}): Promise<{ blob: Blob; exported: number; skipped: number; capped: boolean }> {
  const { layout, branding, settings, signatureUrl, filters, onProgress } = options;
  const normalizedLayout = normalizeIdCardLayout(layout, 'STAFF');

  onProgress?.({ phase: 'loading', done: 0, total: 0 });

  const [staffRes, issues] = await Promise.all([
    fetchAllStaff({
      status: filters?.status || 'ACTIVE',
      departmentId: filters?.departmentId,
      staffType: filters?.staffType,
      designationId: filters?.designationId,
    }),
    fetchAllStaffIdCardIssues({
      departmentId: filters?.departmentId,
      staffType: filters?.staffType,
    }),
  ]);

  const issuesByStaffId = indexLatestStaffIssues(issues);
  const withCards = sortStaffByName(staffRes.data.filter((row) => issuesByStaffId.has(row.id)));
  const skipped = staffRes.data.length - withCards.length;

  if (withCards.length === 0) {
    throw new Error(
      'No staff with generated card records match your filters. Run bulk generate first.',
    );
  }

  const capped = withCards.length > MAX_STAFF_BULK_PDF;
  const exportRows = withCards.slice(0, MAX_STAFF_BULK_PDF);
  const pages: string[] = [];

  onProgress?.({ phase: 'building', done: 0, total: exportRows.length });

  for (let i = 0; i < exportRows.length; i += 1) {
    const staff = exportRows[i]!;
    const issue = issuesByStaffId.get(staff.id);
    const base = buildStaffIdCardModelFromProfile({
      profile: staff as StaffProfile,
      branding: branding ?? undefined,
      cardNumber: issue?.cardNumber ?? null,
      validityYears: settings?.validityYears,
    });
    const model = enhanceStaffCardModel(base, { activeIssue: issue, settings: settings ?? null });
    const holderType = staffHolderTypeForGenerate(staff.staffType);
    const { frontHtml, backHtml } = buildCr80PrintDocument({
      model,
      layout: normalizedLayout,
      holderType,
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

export function staffBulkPdfFilename(departmentName?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = departmentName
    ? departmentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
    : 'all-staff';
  return `staff-id-cards-${slug}-${date}.pdf`;
}
