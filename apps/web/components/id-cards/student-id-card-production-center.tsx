'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileDown,
  Fingerprint,
  Loader2,
  Printer,
  QrCode,
  Search,
  Users,
} from 'lucide-react';

import {
  formatBulkGenerateMessage,
  studentBulkScopeLabel,
} from '@/components/id-cards/id-card-bulk-utils';
import {
  exportStudentIdCardsBulkPdf,
  MAX_STUDENT_BULK_PDF,
  studentBulkPdfFilename,
  type StudentBulkPdfExportProgress,
} from '@/components/id-cards/export-student-id-cards-bulk-pdf';
import {
  buildIdVerificationReport,
  openIdVerificationReportPreview,
} from '@/components/id-cards/export-id-verification-report';
import {
  ProductionCardPreview,
  type ProductionViewMode,
} from '@/components/id-cards/production-card-preview';
import {
  buildCr80PrintDocument,
  buildCr80PrintHtmlDocument,
} from '@/components/id-cards/build-cr80-print-html';
import { buildStudentIdCardModelFromProfile } from '@/components/id-cards/build-student-id-card-model-from-profile';
import { enhanceStudentCardModel } from '@/components/id-cards/enhance-student-card-model';
import { pickDefaultTemplate } from '@/components/id-cards/id-card-template-utils';
import { normalizeIdCardLayout } from '@/components/id-cards/layout-legacy-migrate';
import { resolveInstitutionSignatureUrl } from '@/components/id-cards/resolve-institution-signature-url';
import { openCr80PrintPreview } from '@/components/id-cards/print-cr80-id-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  bulkGenerateIdCards,
  fetchIdCardDashboard,
  fetchIdCardIssues,
  fetchIdCardPrintRequests,
  fetchIdCardTemplates,
  fetchIdCardSettings,
  generateIdCard,
  renderIdCardPdf,
  verifyIdCardPublic,
} from '@/services/id-cards';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import {
  fetchEnhancedStudentsSummary,
  fetchStudentProfile,
  fetchStudents,
} from '@/services/students';
import type { StudentDirectoryRow, StudentProfile } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function StudentRowCard({
  row,
  selected,
  onSelect,
}: {
  row: StudentDirectoryRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const photo = row.photoPath ? resolveUploadAssetUrl(row.photoPath) : null;
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3 transition-colors',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border/60 bg-card hover:border-primary/40',
      )}
    >
      <button type="button" onClick={onSelect} className="shrink-0">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-12 w-12 rounded-lg border object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted text-sm font-bold text-muted-foreground">
            {(row.displayFullName ?? row.fullName).charAt(0)}
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onSelect} className="w-full text-left">
          <p className="truncate text-sm font-semibold">{row.displayFullName ?? row.fullName}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.enrollmentNumber}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[row.programme ?? row.majorSubject, row.semester ? `Sem ${row.semester}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.rfidNumber ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
                <Fingerprint className="h-2.5 w-2.5" /> RFID
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                RFID pending
              </span>
            )}
          </div>
        </button>
        <Button
          type="button"
          size="sm"
          variant={selected ? 'default' : 'outline'}
          className="mt-2 h-7 w-full text-xs"
          onClick={onSelect}
        >
          <Eye className="mr-1 h-3 w-3" /> Preview
        </Button>
      </div>
    </div>
  );
}

export function StudentIdCardProductionCenter() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const { branding } = useInstitutionBranding();

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [rfidFilter, setRfidFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [viewMode, setViewMode] = useState<ProductionViewMode>('front');
  const [message, setMessage] = useState('');
  const [printing, setPrinting] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [verificationReportLoading, setVerificationReportLoading] = useState(false);
  const [qrTestResult, setQrTestResult] = useState<string | null>(null);

  const dashboardQ = useQuery({
    queryKey: ['id-cards', 'dashboard'],
    queryFn: fetchIdCardDashboard,
    enabled,
  });
  const summaryQ = useQuery({
    queryKey: ['students', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStudentsSummary,
    enabled,
  });
  const queueQ = useQuery({
    queryKey: ['id-cards', 'print-queue', 'PENDING'],
    queryFn: () => fetchIdCardPrintRequests('PENDING'),
    enabled,
  });
  const departmentsQ = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });
  const yearsQ = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears, enabled });
  const templatesQ = useQuery({
    queryKey: ['id-cards', 'templates'],
    queryFn: fetchIdCardTemplates,
    enabled,
  });
  const settingsQ = useQuery({
    queryKey: ['id-cards', 'settings'],
    queryFn: fetchIdCardSettings,
    enabled,
  });

  const signatureUrl = useMemo(
    () => resolveInstitutionSignatureUrl(settingsQ.data?.institutionSignatureUrl),
    [settingsQ.data?.institutionSignatureUrl],
  );

  const studentsQ = useQuery({
    queryKey: [
      'id-cards',
      'production',
      'students',
      search,
      departmentId,
      semester,
      sessionId,
      rfidFilter,
      statusFilter,
    ],
    queryFn: () =>
      fetchStudents({
        limit: 30,
        search: search.trim() || undefined,
        departmentId: departmentId || undefined,
        semester: semester || undefined,
        sessionId: sessionId || undefined,
        rfidAssigned: rfidFilter || undefined,
        academicStatus: statusFilter || undefined,
      }),
    enabled: enabled && search.trim().length >= 2,
  });

  const profileQ = useQuery({
    queryKey: ['students', selectedStudentId, 'profile'],
    queryFn: () => fetchStudentProfile(selectedStudentId),
    enabled: enabled && Boolean(selectedStudentId),
  });

  const issuesQ = useQuery({
    queryKey: ['id-cards', 'issues', selectedStudentId],
    queryFn: () => fetchIdCardIssues({ holderType: 'STUDENT', studentId: selectedStudentId }),
    enabled: enabled && Boolean(selectedStudentId),
  });

  const defaultTemplate = pickDefaultTemplate(templatesQ.data, 'STUDENT', 'dbc-pursuit-excellence');
  const layout = useMemo(() => defaultTemplate?.layout ?? null, [defaultTemplate]);
  const normalizedLayout = useMemo(
    () => (layout ? normalizeIdCardLayout(layout, 'STUDENT') : null),
    [layout],
  );

  const activeIssue = issuesQ.data?.[0];

  const model = useMemo(() => {
    if (!profileQ.data) return null;
    const base = buildStudentIdCardModelFromProfile({
      profile: profileQ.data,
      branding: branding ?? undefined,
    });
    return enhanceStudentCardModel(base, {
      activeIssue,
      settings: settingsQ.data ?? null,
    });
  }, [profileQ.data, branding, activeIssue, settingsQ.data]);
  const cardStatus = activeIssue?.status ?? 'NOT_GENERATED';

  const selectStudent = useCallback((id: string) => {
    setSelectedStudentId(id);
    setQrTestResult(null);
  }, []);

  const runPrintPreview = async () => {
    if (!model || !normalizedLayout) return;
    setPrinting(true);
    try {
      await openCr80PrintPreview({
        model,
        layout: normalizedLayout,
        holderType: 'STUDENT',
        purpose: 'preview',
        signatureUrl,
      });
    } finally {
      setPrinting(false);
    }
  };

  const runDownloadPdf = async () => {
    if (!model || !normalizedLayout) return;
    setPrinting(true);
    try {
      const { frontHtml, backHtml } = buildCr80PrintDocument({
        model,
        layout: normalizedLayout,
        purpose: 'preview',
        signatureUrl,
      });
      const html = buildCr80PrintHtmlDocument(frontHtml, backHtml);
      const blob = await renderIdCardPdf(html);
      downloadBlob(blob, `${model.holder.rollNumber.replace(/\s+/g, '-')}-id-card.pdf`);
    } catch (e) {
      setMessage(apiErrorMessage(e, 'PDF generation failed'));
    } finally {
      setPrinting(false);
    }
  };

  const generateMut = useMutation({
    mutationFn: () => generateIdCard({ holderType: 'STUDENT', studentId: selectedStudentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
      setMessage('Card record generated.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Generation failed')),
  });

  const bulkMut = useMutation({
    mutationFn: (payload: Parameters<typeof bulkGenerateIdCards>[0]) =>
      bulkGenerateIdCards(payload),
    onSuccess: (res) => {
      setMessage(formatBulkGenerateMessage(res, 'student'));
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk operation failed')),
  });

  const runBulkPdfExport = async () => {
    if (!normalizedLayout) return;
    const departmentName = departmentId
      ? (departmentsQ.data ?? []).find((dep) => dep.id === departmentId)?.name
      : undefined;
    const sessionName = sessionId
      ? (yearsQ.data ?? []).find((y) => y.id === sessionId)?.name
      : undefined;
    const scope = studentBulkScopeLabel({
      departmentName,
      semester: semester || undefined,
      sessionName,
    });
    const confirmed = window.confirm(
      `Export a single PDF with front + back pages for ${scope} who already have generated card records?\n\nUp to ${MAX_STUDENT_BULK_PDF} students per file. Run bulk generate first for students without cards.`,
    );
    if (!confirmed) return;

    setBulkExporting(true);
    setMessage('Preparing bulk PDF export…');
    try {
      const result = await exportStudentIdCardsBulkPdf({
        layout: normalizedLayout,
        branding: branding ?? undefined,
        settings: settingsQ.data ?? null,
        signatureUrl,
        filters: {
          departmentId: departmentId || undefined,
          semester: semester || undefined,
          sessionId: sessionId || undefined,
          academicStatus: statusFilter || 'ACTIVE',
        },
        onProgress: (progress: StudentBulkPdfExportProgress) => {
          if (progress.phase === 'loading') {
            setMessage('Loading students and card records…');
          } else if (progress.phase === 'profiles') {
            setMessage(`Loading profiles ${progress.done}/${progress.total}…`);
          } else if (progress.phase === 'building') {
            setMessage(`Building card pages ${progress.done}/${progress.total}…`);
          } else {
            setMessage('Rendering PDF (this may take a minute)…');
          }
        },
      });
      downloadBlob(
        result.blob,
        studentBulkPdfFilename({ departmentName, semester: semester || undefined }),
      );
      const parts = [`Exported ${result.exported} students (${result.exported * 2} pages).`];
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (no card record).`);
      if (result.capped)
        parts.push(
          `Limited to ${MAX_STUDENT_BULK_PDF} students — narrow filters to export more batches.`,
        );
      setMessage(parts.join(' '));
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Bulk PDF export failed'));
    } finally {
      setBulkExporting(false);
    }
  };

  const runVerificationReport = async () => {
    if (!departmentId) {
      setMessage(
        'Select a department filter first to print a department-wise verification report.',
      );
      return;
    }
    const departmentName = (departmentsQ.data ?? []).find((dep) => dep.id === departmentId)?.name;
    const sessionName = sessionId
      ? (yearsQ.data ?? []).find((y) => y.id === sessionId)?.name
      : undefined;

    setVerificationReportLoading(true);
    setMessage('Preparing verification report…');
    try {
      const result = await buildIdVerificationReport({
        branding: branding ?? undefined,
        departmentName,
        sessionName,
        filters: {
          departmentId,
          semester: semester || undefined,
          sessionId: sessionId || undefined,
          academicStatus: statusFilter || 'ACTIVE',
          groupByDepartment: false,
        },
      });
      openIdVerificationReportPreview(result.html, result.meta.reportTitle);
      setMessage(
        `Verification report ready — ${result.meta.totalStudents} students in ${departmentName ?? 'department'}.`,
      );
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Verification report failed'));
    } finally {
      setVerificationReportLoading(false);
    }
  };

  const testQr = async () => {
    const code = activeIssue?.cardNumber ?? model?.verification.qrPayload ?? '';
    if (!code) {
      setQrTestResult('No QR payload — generate a card first.');
      return;
    }
    const res = await verifyIdCardPublic(code);
    setQrTestResult(
      res.valid ? `Valid — ${res.display?.name ?? code}` : (res.message ?? 'Verification failed'),
    );
  };

  const d = dashboardQ.data;
  const pendingQueue = queueQ.data?.length ?? 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">ID Card Production Center</h2>
        <p className="text-sm text-muted-foreground">
          Generate, preview, print and manage student identity cards.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Students" value={summaryQ.data?.total ?? '—'} sub="Active directory" />
        <StatCard label="Printed" value={d?.studentCards.printed ?? '—'} />
        <StatCard
          label="Pending"
          value={d?.studentCards.pending ?? pendingQueue}
          sub="Print queue"
        />
        <StatCard label="RFID assigned" value={d?.rfid.studentMapped ?? d?.rfid.mapped ?? '—'} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr_minmax(240px,280px)]">
        <div className="flex min-h-[520px] flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-card/50">
          <div className="space-y-2 border-b border-border/60 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, Reg No, Roll No, RFID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="">Academic year</option>
                {(yearsQ.data ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Department</option>
                {(departmentsQ.data ?? []).map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="">Semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={String(s)}>
                    Semester {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={rfidFilter}
                onChange={(e) => setRfidFilter(e.target.value)}
              >
                <option value="">RFID status</option>
                <option value="true">Assigned</option>
                <option value="false">Pending</option>
              </select>
              <select
                className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Academic status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 pt-0">
            {search.trim().length < 2 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Type at least 2 characters to search students.
              </p>
            ) : studentsQ.isLoading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Searching…</p>
            ) : studentsQ.data?.data?.length ? (
              studentsQ.data.data.map((row) => (
                <StudentRowCard
                  key={row.id}
                  row={row}
                  selected={selectedStudentId === row.id}
                  onSelect={() => selectStudent(row.id)}
                />
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No students found.</p>
            )}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
            <div className="flex gap-1">
              {(['front', 'back', 'dual'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={viewMode === mode ? 'default' : 'outline'}
                  className="h-8 capitalize"
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'dual' ? 'Dual view' : mode}
                </Button>
              ))}
            </div>
            {profileQ.data ? (
              <p className="truncate text-sm font-medium">
                {profileQ.data.displayFullName ?? profileQ.data.fullName}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Select a student to preview</p>
            )}
          </div>

          {model && normalizedLayout ? (
            <ProductionCardPreview
              model={model}
              layout={normalizedLayout}
              viewMode={viewMode}
              signatureUrl={signatureUrl}
            />
          ) : profileQ.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 opacity-30" />
              <p className="text-sm">
                Search and select a student to inspect their ID card at full size.
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-[520px] flex-col gap-3 overflow-y-auto">
          {profileQ.data ? (
            <StudentInfoSidebar
              profile={profileQ.data}
              templateName={defaultTemplate?.name}
              cardStatus={cardStatus}
              issue={activeIssue}
              qrTestResult={qrTestResult}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Student details appear here when selected.
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Print queue
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{pendingQueue}</p>
                <p className="text-[10px] text-muted-foreground">Ready</p>
              </div>
              <div className="rounded-lg bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">{printing ? 1 : 0}</p>
                <p className="text-[10px] text-muted-foreground">Printing</p>
              </div>
              <div className="rounded-lg bg-muted/50 py-2">
                <p className="text-lg font-bold tabular-nums">0</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/id-cards/print-queue">Open full queue</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-3 text-xs">
            <p className="font-semibold">Evolis Primacy</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Printer online
              </li>
              <li>Ribbon: YMCKO · CR80 portrait · Dual-side</li>
              <li>Resolution: 300 DPI · Actual-size PDF</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 rounded-xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur">
        {message ? <p className="mb-2 text-xs text-muted-foreground">{message}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!model || !normalizedLayout || printing}
            onClick={() => void runPrintPreview()}
          >
            {printing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Print Preview
          </Button>
          <Button
            variant="secondary"
            disabled={!model || !normalizedLayout || printing}
            onClick={() => void runDownloadPdf()}
          >
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button
            variant="outline"
            disabled={!selectedStudentId || generateMut.isPending}
            onClick={() => generateMut.mutate()}
          >
            Generate record
          </Button>
          <Button variant="outline" disabled={!model} onClick={() => void testQr()}>
            <QrCode className="mr-2 h-4 w-4" /> Test QR
          </Button>
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <Button
            variant="outline"
            size="sm"
            disabled={bulkMut.isPending}
            onClick={() =>
              bulkMut.mutate({
                holderType: 'STUDENT',
                departmentId: departmentId || undefined,
                semester: semester ? Number(semester) : undefined,
              })
            }
          >
            Bulk: {departmentId ? 'Department' : semester ? 'Semester' : 'Cohort'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!normalizedLayout || bulkExporting || printing}
            onClick={() => void runBulkPdfExport()}
          >
            {bulkExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Bulk export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={verificationReportLoading || !departmentId}
            onClick={() => void runVerificationReport()}
          >
            {verificationReportLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="mr-2 h-4 w-4" />
            )}
            Verification report
          </Button>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/admin/id-cards/templates">Edit template</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudentInfoSidebar({
  profile,
  templateName,
  cardStatus,
  issue,
  qrTestResult,
}: {
  profile: StudentProfile;
  templateName?: string;
  cardStatus: string;
  issue?: { cardNumber: string; status: string; createdAt: string; printedAt?: string | null };
  qrTestResult: string | null;
}) {
  const photo = profile.photoPath ? resolveUploadAssetUrl(profile.photoPath) : null;
  const father = profile.guardians?.find((g) => g.guardianType.toUpperCase() === 'FATHER');
  const mother = profile.guardians?.find((g) => g.guardianType.toUpperCase() === 'MOTHER');

  const statusColors: Record<string, string> = {
    GENERATED: 'bg-blue-500/10 text-blue-700',
    PRINTED: 'bg-emerald-500/10 text-emerald-700',
    ASSIGNED: 'bg-violet-500/10 text-violet-700',
    LOST: 'bg-red-500/10 text-red-700',
    DISABLED: 'bg-slate-500/10 text-slate-600',
    NOT_GENERATED: 'bg-amber-500/10 text-amber-700',
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <div className="flex gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-16 w-16 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted font-bold">
              {profile.fullName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-tight">
              {profile.displayFullName ?? profile.fullName}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {profile.enrollmentNumber}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {profile.programme ?? profile.majorSubject ?? '—'}
            </p>
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-xs">
          <InfoRow label="Roll No" value={profile.rollNumber ?? '—'} />
          <InfoRow
            label="Department"
            value={profile.departmentName ?? profile.majorSubject ?? '—'}
          />
          <InfoRow label="Semester" value={profile.semester ? String(profile.semester) : '—'} />
          <InfoRow label="Gender" value={profile.gender ?? '—'} />
          <InfoRow label="Father" value={father?.fullName ?? '—'} />
          <InfoRow label="Mother" value={mother?.fullName ?? '—'} />
          <InfoRow
            label="RFID"
            value={
              profile.rfidNumber ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Assigned
                </span>
              ) : (
                'Pending'
              )
            }
          />
          <InfoRow label="Template" value={templateName ?? 'Student default'} />
        </dl>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Card status
        </p>
        <span
          className={cn(
            'mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            statusColors[cardStatus] ?? statusColors.NOT_GENERATED,
          )}
        >
          {cardStatus.replace(/_/g, ' ')}
        </span>
        {issue ? (
          <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <InfoRow label="Card no" value={issue.cardNumber} mono />
            <InfoRow label="Generated" value={new Date(issue.createdAt).toLocaleString()} />
            {issue.printedAt ? (
              <InfoRow label="Printed" value={new Date(issue.printedAt).toLocaleString()} />
            ) : null}
          </dl>
        ) : null}
      </div>

      {qrTestResult ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          {qrTestResult}
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium', mono && 'font-mono text-[10px]')}>{value}</dd>
    </div>
  );
}
