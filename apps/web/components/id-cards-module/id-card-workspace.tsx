'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, LayoutTemplate, RefreshCw, ScanLine, Settings } from 'lucide-react';

import {
  formatBulkGenerateMessage,
  staffBulkScopeLabel,
  studentBulkScopeLabel,
} from '@/components/id-cards/id-card-bulk-utils';
import {
  exportStaffIdCardsBulkPdf,
  MAX_STAFF_BULK_PDF,
  staffBulkPdfFilename,
} from '@/components/id-cards/export-staff-id-cards-bulk-pdf';
import {
  exportStudentIdCardsBulkPdf,
  MAX_STUDENT_BULK_PDF,
  studentBulkPdfFilename,
} from '@/components/id-cards/export-student-id-cards-bulk-pdf';
import { pickDefaultTemplate } from '@/components/id-cards/id-card-template-utils';
import { normalizeIdCardLayout } from '@/components/id-cards/layout-legacy-migrate';
import { resolveInstitutionSignatureUrl } from '@/components/id-cards/resolve-institution-signature-url';
import { StaffIdCardProductionCenter } from '@/components/id-cards/staff-id-card-production-center';
import { StudentIdCardProductionCenter } from '@/components/id-cards/student-id-card-production-center';
import { IdCardTemplateDesigner } from '@/components/id-cards-module/id-card-template-designer';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import {
  bulkGenerateIdCards,
  completeIdCardPrintRequest,
  fetchIdCardDashboard,
  fetchIdCardPrintRequests,
  fetchIdCardReportsSummary,
  fetchIdCardSettings,
  fetchIdCardTemplates,
  updateIdCardSettings,
} from '@/services/id-cards';
import { fetchAcademicDepartments } from '@/services/organization';
import { STAFF_TYPES } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

export type IdCardPage =
  | 'dashboard'
  | 'templates'
  | 'students'
  | 'staff'
  | 'bulk'
  | 'print-queue'
  | 'rfid'
  | 'reissue'
  | 'verification'
  | 'reports'
  | 'settings';

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </GlassCard>
  );
}

export function IdCardWorkspace({ page = 'dashboard' }: { page?: IdCardPage }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const { branding } = useInstitutionBranding();
  const [bulkHolderType, setBulkHolderType] = useState<'STUDENT' | 'STAFF'>('STUDENT');
  const [bulkSemester, setBulkSemester] = useState('1');
  const [bulkDepartmentId, setBulkDepartmentId] = useState('');
  const [bulkStaffType, setBulkStaffType] = useState('');
  const [bulkExporting, setBulkExporting] = useState(false);
  const [message, setMessage] = useState('');

  const bulkDepartmentsQ = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: enabled && page === 'bulk',
  });

  const bulkTemplatesQ = useQuery({
    queryKey: ['id-cards', 'templates'],
    queryFn: fetchIdCardTemplates,
    enabled: enabled && page === 'bulk',
  });

  const bulkSettingsQ = useQuery({
    queryKey: ['id-cards', 'settings'],
    queryFn: fetchIdCardSettings,
    enabled: enabled && page === 'bulk',
  });

  const bulkStaffLayout = useMemo(() => {
    const template = pickDefaultTemplate(bulkTemplatesQ.data, 'STAFF', 'dbc-pursuit-staff');
    return template?.layout ? normalizeIdCardLayout(template.layout, 'STAFF') : null;
  }, [bulkTemplatesQ.data]);

  const bulkStudentLayout = useMemo(() => {
    const template = pickDefaultTemplate(bulkTemplatesQ.data, 'STUDENT', 'dbc-pursuit-excellence');
    return template?.layout ? normalizeIdCardLayout(template.layout, 'STUDENT') : null;
  }, [bulkTemplatesQ.data]);

  const bulkSignatureUrl = useMemo(
    () => resolveInstitutionSignatureUrl(bulkSettingsQ.data?.institutionSignatureUrl),
    [bulkSettingsQ.data?.institutionSignatureUrl],
  );

  const dashboardQ = useQuery({
    queryKey: ['id-cards', 'dashboard'],
    queryFn: fetchIdCardDashboard,
    enabled: enabled && page === 'dashboard',
  });

  const queueQ = useQuery({
    queryKey: ['id-cards', 'print-queue', 'PENDING'],
    queryFn: () => fetchIdCardPrintRequests('PENDING'),
    enabled: enabled && (page === 'print-queue' || page === 'dashboard'),
  });

  const settingsQ = useQuery({
    queryKey: ['id-cards', 'settings'],
    queryFn: fetchIdCardSettings,
    enabled: enabled && page === 'settings',
  });

  const reportsQ = useQuery({
    queryKey: ['id-cards', 'reports'],
    queryFn: fetchIdCardReportsSummary,
    enabled: enabled && page === 'reports',
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => completeIdCardPrintRequest(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
      setMessage('Print request marked complete.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not complete request')),
  });

  const bulkMut = useMutation({
    mutationFn: () => {
      if (bulkHolderType === 'STAFF') {
        const departmentName = bulkDepartmentId
          ? (bulkDepartmentsQ.data ?? []).find((dep) => dep.id === bulkDepartmentId)?.name
          : undefined;
        const staffTypeLabel = bulkStaffType
          ? bulkStaffType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : undefined;
        const scope = staffBulkScopeLabel({ departmentName, staffTypeLabel });
        const confirmed = window.confirm(
          `Generate ID card records for ${scope}?\n\nStaff who already have an active card will be skipped. Up to 2,000 staff per run.`,
        );
        if (!confirmed) return Promise.reject(new Error('cancelled'));
        return bulkGenerateIdCards({
          holderType: 'STAFF',
          departmentId: bulkDepartmentId || undefined,
          staffType: bulkStaffType || undefined,
        });
      }
      return bulkGenerateIdCards({
        holderType: 'STUDENT',
        semester: Number(bulkSemester) || 1,
      });
    },
    onSuccess: (res) => {
      setMessage(formatBulkGenerateMessage(res, bulkHolderType === 'STAFF' ? 'staff' : 'student'));
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'cancelled') return;
      setMessage(apiErrorMessage(e, 'Bulk generation failed'));
    },
  });

  const settingsMut = useMutation({
    mutationFn: (payload: { qrPrefix?: string; validityYears?: number }) =>
      updateIdCardSettings(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['id-cards', 'settings'] });
      setMessage('Settings saved.');
    },
  });

  if (page === 'dashboard') {
    const d = dashboardQ.data;
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Centralized identity management for students, staff, and future holder types — cards, QR,
          RFID, and verification.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Student cards generated" value={d?.studentCards.generated ?? '—'} />
          <Kpi label="Student pending print" value={d?.studentCards.pending ?? '—'} />
          <Kpi label="Student printed" value={d?.studentCards.printed ?? '—'} />
          <Kpi label="Student assigned" value={d?.studentCards.assigned ?? '—'} />
          <Kpi label="Staff cards generated" value={d?.staffCards.generated ?? '—'} />
          <Kpi label="Staff pending print" value={d?.staffCards.pending ?? '—'} />
          <Kpi label="RFID mapped" value={d?.rfid.mapped ?? '—'} sub="Students + staff" />
          <Kpi label="RFID unmapped students" value={d?.rfid.unmapped ?? '—'} />
          <Kpi label="Active lost cards" value={d?.lostCards.active ?? '—'} />
        </div>
        {(queueQ.data?.length ?? 0) > 0 ? (
          <GlassCard className="p-4">
            <h3 className="font-semibold">Recent print queue</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {queueQ.data!.slice(0, 5).map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>
                    {r.fullName} · {r.requestType}
                  </span>
                  <Link href="/admin/id-cards/print-queue" className="text-primary text-xs">
                    View queue
                  </Link>
                </li>
              ))}
            </ul>
          </GlassCard>
        ) : null}
      </div>
    );
  }

  if (page === 'templates') {
    return <IdCardTemplateDesigner />;
  }

  if (page === 'students') {
    return <StudentIdCardProductionCenter />;
  }

  if (page === 'staff') {
    return <StaffIdCardProductionCenter />;
  }

  if (page === 'bulk') {
    const runBulkStaffPdfExport = async () => {
      if (!bulkStaffLayout) return;
      const departmentName = bulkDepartmentId
        ? (bulkDepartmentsQ.data ?? []).find((dep) => dep.id === bulkDepartmentId)?.name
        : undefined;
      const staffTypeLabel = bulkStaffType
        ? bulkStaffType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : undefined;
      const scope = staffBulkScopeLabel({ departmentName, staffTypeLabel });
      const confirmed = window.confirm(
        `Export one PDF with front + back pages for ${scope} who have generated card records?\n\nUp to ${MAX_STAFF_BULK_PDF} staff per file.`,
      );
      if (!confirmed) return;

      setBulkExporting(true);
      setMessage('Preparing bulk PDF export…');
      try {
        const result = await exportStaffIdCardsBulkPdf({
          layout: bulkStaffLayout,
          branding: branding ?? undefined,
          settings: bulkSettingsQ.data ?? null,
          signatureUrl: bulkSignatureUrl,
          filters: {
            departmentId: bulkDepartmentId || undefined,
            staffType: bulkStaffType || undefined,
          },
          onProgress: (progress) => {
            if (progress.phase === 'building') {
              setMessage(`Building card pages ${progress.done}/${progress.total}…`);
            } else if (progress.phase === 'rendering') {
              setMessage('Rendering PDF…');
            }
          },
        });
        downloadBlob(result.blob, staffBulkPdfFilename(departmentName));
        const parts = [`Exported ${result.exported} staff (${result.exported * 2} pages).`];
        if (result.skipped > 0) parts.push(`${result.skipped} skipped (no card record).`);
        if (result.capped)
          parts.push(`Capped at ${MAX_STAFF_BULK_PDF} — export by department in batches.`);
        setMessage(parts.join(' '));
      } catch (e) {
        setMessage(apiErrorMessage(e, 'Bulk PDF export failed'));
      } finally {
        setBulkExporting(false);
      }
    };

    const runBulkStudentPdfExport = async () => {
      if (!bulkStudentLayout) return;
      const departmentName = bulkDepartmentId
        ? (bulkDepartmentsQ.data ?? []).find((dep) => dep.id === bulkDepartmentId)?.name
        : undefined;
      const scope = studentBulkScopeLabel({
        departmentName,
        semester: bulkSemester || undefined,
      });
      const confirmed = window.confirm(
        `Export one PDF with front + back pages for ${scope} who have generated card records?\n\nUp to ${MAX_STUDENT_BULK_PDF} students per file.`,
      );
      if (!confirmed) return;

      setBulkExporting(true);
      setMessage('Preparing bulk PDF export…');
      try {
        const result = await exportStudentIdCardsBulkPdf({
          layout: bulkStudentLayout,
          branding: branding ?? undefined,
          settings: bulkSettingsQ.data ?? null,
          signatureUrl: bulkSignatureUrl,
          filters: {
            departmentId: bulkDepartmentId || undefined,
            semester: bulkSemester || undefined,
          },
          onProgress: (progress) => {
            if (progress.phase === 'profiles') {
              setMessage(`Loading profiles ${progress.done}/${progress.total}…`);
            } else if (progress.phase === 'building') {
              setMessage(`Building card pages ${progress.done}/${progress.total}…`);
            } else if (progress.phase === 'rendering') {
              setMessage('Rendering PDF…');
            }
          },
        });
        downloadBlob(
          result.blob,
          studentBulkPdfFilename({ departmentName, semester: bulkSemester || undefined }),
        );
        const parts = [`Exported ${result.exported} students (${result.exported * 2} pages).`];
        if (result.skipped > 0) parts.push(`${result.skipped} skipped (no card record).`);
        if (result.capped)
          parts.push(
            `Capped at ${MAX_STUDENT_BULK_PDF} — export by semester/department in batches.`,
          );
        setMessage(parts.join(' '));
      } catch (e) {
        setMessage(apiErrorMessage(e, 'Bulk PDF export failed'));
      } finally {
        setBulkExporting(false);
      }
    };

    return (
      <GlassCard className="space-y-4 p-6">
        <h3 className="font-semibold">Bulk card generation</h3>
        <p className="text-sm text-muted-foreground">
          Generate identity records for student or staff cohorts. Cards receive unique numbers like{' '}
          <code className="text-xs">DBC-STU-2026-0001</code> or{' '}
          <code className="text-xs">DBC-STF-2026-0001</code> for QR verification. Existing active
          cards are skipped.
        </p>
        <div className="flex max-w-xl flex-wrap items-end gap-2">
          <div className="min-w-[120px] flex-1">
            <label className="text-xs font-medium">Holder type</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={bulkHolderType}
              onChange={(e) => setBulkHolderType(e.target.value as 'STUDENT' | 'STAFF')}
            >
              <option value="STUDENT">Students</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>
          {bulkHolderType === 'STUDENT' ? (
            <>
              <div className="min-w-[100px] flex-1">
                <label className="text-xs font-medium">Semester</label>
                <Input value={bulkSemester} onChange={(e) => setBulkSemester(e.target.value)} />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="text-xs font-medium">Department</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={bulkDepartmentId}
                  onChange={(e) => setBulkDepartmentId(e.target.value)}
                >
                  <option value="">All departments</option>
                  {(bulkDepartmentsQ.data ?? []).map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="min-w-[140px] flex-1">
                <label className="text-xs font-medium">Department</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={bulkDepartmentId}
                  onChange={(e) => setBulkDepartmentId(e.target.value)}
                >
                  <option value="">All departments</option>
                  {(bulkDepartmentsQ.data ?? []).map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[120px] flex-1">
                <label className="text-xs font-medium">Staff type</label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={bulkStaffType}
                  onChange={(e) => setBulkStaffType(e.target.value)}
                >
                  <option value="">All types</option>
                  {STAFF_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <Button disabled={bulkMut.isPending} onClick={() => bulkMut.mutate()}>
            {bulkMut.isPending
              ? 'Generating…'
              : bulkHolderType === 'STAFF'
                ? 'Generate all staff'
                : 'Generate'}
          </Button>
          {bulkHolderType === 'STAFF' ? (
            <Button
              variant="secondary"
              disabled={!bulkStaffLayout || bulkExporting}
              onClick={() => void runBulkStaffPdfExport()}
            >
              {bulkExporting ? 'Exporting PDF…' : 'Export staff PDF'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={!bulkStudentLayout || bulkExporting}
              onClick={() => void runBulkStudentPdfExport()}
            >
              {bulkExporting ? 'Exporting PDF…' : 'Export student PDF'}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PDF export includes front and back for each{' '}
          {bulkHolderType === 'STAFF' ? 'staff member' : 'student'} with a generated card (max{' '}
          {bulkHolderType === 'STAFF' ? MAX_STAFF_BULK_PDF : MAX_STUDENT_BULK_PDF} per file).
          Generate records first, then export.
        </p>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </GlassCard>
    );
  }

  if (page === 'print-queue') {
    const rows = queueQ.data ?? [];
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Student and staff print requests submitted from the portal. Complete after printing on
          Evolis Primacy.
        </p>
        {message ? <p className="text-sm">{message}</p> : null}
        {rows.length === 0 ? (
          <GlassCard className="p-6 text-sm text-muted-foreground">No pending requests.</GlassCard>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{r.fullName ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.enrollmentNumber} · {r.requestType}
                    {r.note ? ` · ${r.note}` : ''} · {new Date(r.submittedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.studentId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/students/${r.studentId}?tab=id-card`}>Print</Link>
                    </Button>
                  ) : null}
                  {r.staffProfileId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/staff/${r.staffProfileId}?tab=id-card`}>Print</Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={completeMut.isPending}
                    onClick={() => completeMut.mutate(r.id)}
                  >
                    Mark printed
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (page === 'rfid') {
    return (
      <GlassCard className="p-6">
        <Fingerprint className="mb-2 h-8 w-8 text-primary" />
        <h3 className="font-semibold">RFID mapping</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          RFID UIDs are stored on student and staff records and linked to card issues. Use existing
          RFID tools for assignment.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/students/rfid">Student RFID</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/staff">Staff profiles</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  if (page === 'reissue') {
    return (
      <GlassCard className="p-6">
        <RefreshCw className="mb-2 h-8 w-8 text-primary" />
        <h3 className="font-semibold">Card reissue</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Track lost, damaged, RFID failure, name correction, and department change reissues. Open a
          student profile ID Card tab or use Print Queue after a student submits a reprint request.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          API supports reissue with reason codes and fee tracking — UI wizard coming next.
        </p>
      </GlassCard>
    );
  }

  if (page === 'verification') {
    return (
      <GlassCard className="p-6">
        <ScanLine className="mb-2 h-8 w-8 text-primary" />
        <h3 className="font-semibold">Verification portal</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Public verification URL scans QR codes (e.g. DBC-STU-2026-0001) and shows Valid Student /
          Valid Staff with photo, name, and department — no sensitive data.
        </p>
        <p className="mt-3 text-sm">
          Public route:{' '}
          <Link
            href="/verify/demo"
            className="font-mono text-primary underline-offset-2 hover:underline"
          >
            /verify/[card-number]
          </Link>
        </p>
      </GlassCard>
    );
  }

  if (page === 'reports') {
    const r = reportsQ.data;
    return (
      <div className="space-y-4">
        <GlassCard className="p-4">
          <h3 className="font-semibold">Pre-print verification</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Print department-wise student data sheets for verification before ID cards are produced.
          </p>
          <Button asChild className="mt-3" variant="secondary">
            <Link href="/admin/id-cards/verification-report">Open verification report</Link>
          </Button>
        </GlassCard>
        <div className="grid gap-3 sm:grid-cols-2">
          <Kpi label="Pending print jobs" value={r?.pendingPrint ?? '—'} />
          <Kpi label="Total reissues" value={r?.reissueCount ?? '—'} />
          <GlassCard className="col-span-full p-4 text-sm">
            <h3 className="font-semibold">Issues by status</h3>
            <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
              {JSON.stringify(r?.issuesByStatus ?? [], null, 2)}
            </pre>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (page === 'settings') {
    const s = settingsQ.data;
    return (
      <GlassCard className="space-y-4 p-6">
        <Settings className="h-6 w-6 text-primary" />
        <h3 className="font-semibold">ID card settings</h3>
        <div className="grid max-w-md gap-3">
          <div>
            <label className="text-xs font-medium">QR prefix (e.g. DBC)</label>
            <Input
              defaultValue={s?.qrPrefix ?? 'DBC'}
              onBlur={(e) => settingsMut.mutate({ qrPrefix: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Validity (years)</label>
            <Input
              type="number"
              defaultValue={s?.validityYears ?? 2}
              onBlur={(e) => settingsMut.mutate({ validityYears: Number(e.target.value) })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Card size: CR80 portrait {s?.cardWidthMm ?? '53.98'} × {s?.cardHeightMm ?? '85.6'} mm ·
            Barcode: {s?.barcodeFormat ?? 'CODE128'}
          </p>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
      </GlassCard>
    );
  }

  return null;
}
